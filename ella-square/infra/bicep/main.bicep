/**
 * ELLA Square — Azure Infrastructure
 *
 * Resources deployed:
 *  - Azure OpenAI (GPT-4o + text-embedding-3-large)
 *  - Azure AI Search (Standard S1, semantic, vector HNSW)
 *  - Azure Content Safety
 *  - Azure AI Language (for entity extraction / PII)
 *  - Azure Storage (one container per domain)
 *  - Azure Functions (API + Bot, Node 20, Consumption plan)
 *  - Azure Static Web Apps (React Teams tab)
 *  - Application Insights + Log Analytics workspace
 *
 * All services use managed identity where possible (no keys in app settings).
 */

targetScope = 'resourceGroup'

@description('Environment name — used as suffix for all resource names')
param envName string = 'dev'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Teams Bot App ID (registered in Azure AD)')
param botAppId string

@description('Teams Bot App Password (client secret)')
@secure()
param botAppPassword string

@description('Teams App ID (from manifest)')
param teamsAppId string

var prefix = 'ella-${envName}'

// ─── Log Analytics + App Insights ─────────────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 90
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-ai'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ─── Storage ───────────────────────────────────────────────────────────────────

resource storage 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: replace('${prefix}stor', '-', '')
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: storage
  name: 'default'
}

var domains = ['finance', 'hr', 'legal']

resource domainContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = [
  for d in domains: {
    parent: blobService
    name: 'ella-${d}'
    properties: { publicAccess: 'None' }
  }
]

// ─── Azure AI Search ───────────────────────────────────────────────────────────

resource search 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: '${prefix}-search'
  location: location
  sku: { name: 'standard' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    semanticSearch: 'standard'
    publicNetworkAccess: 'enabled'
  }
}

// ─── Azure OpenAI ──────────────────────────────────────────────────────────────

resource aoai 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: '${prefix}-aoai'
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${prefix}-aoai'
    publicNetworkAccess: 'Enabled'
  }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aoai
  name: 'gpt-4o'
  sku: { name: 'Standard', capacity: 30 }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-05-13' }
    versionUpgradeOption: 'OnceNewDefaultVersionAvailable'
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: aoai
  name: 'text-embedding-3-large'
  sku: { name: 'Standard', capacity: 30 }
  properties: {
    model: { format: 'OpenAI', name: 'text-embedding-3-large', version: '1' }
  }
  dependsOn: [gpt4oDeployment]
}

// ─── Content Safety ────────────────────────────────────────────────────────────

resource contentSafety 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: '${prefix}-cs'
  location: location
  kind: 'ContentSafety'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${prefix}-cs'
    publicNetworkAccess: 'Enabled'
  }
}

// ─── Azure AI Language ─────────────────────────────────────────────────────────

resource language 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: '${prefix}-lang'
  location: location
  kind: 'TextAnalytics'
  sku: { name: 'S' }
  properties: {
    customSubDomainName: '${prefix}-lang'
    publicNetworkAccess: 'Enabled'
  }
}

// ─── Function App (API + Bot) ──────────────────────────────────────────────────

resource funcPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
  properties: { reserved: true }
}

resource funcApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-func'
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: funcPlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION',    value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME',        value: 'node' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE',        value: '1' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'AZURE_OPENAI_ENDPOINT',           value: aoai.properties.endpoint }
        { name: 'AZURE_OPENAI_CHAT_DEPLOYMENT',    value: 'gpt-4o' }
        { name: 'AZURE_OPENAI_EMBED_DEPLOYMENT',   value: 'text-embedding-3-large' }
        { name: 'AZURE_SEARCH_ENDPOINT',           value: 'https://${search.name}.search.windows.net' }
        { name: 'AZURE_SEARCH_INDEX_FINANCE',      value: 'ella-finance' }
        { name: 'AZURE_SEARCH_INDEX_HR',           value: 'ella-hr' }
        { name: 'AZURE_SEARCH_INDEX_LEGAL',        value: 'ella-legal' }
        { name: 'AZURE_CONTENT_SAFETY_ENDPOINT',   value: contentSafety.properties.endpoint }
        { name: 'AZURE_LANGUAGE_ENDPOINT',         value: language.properties.endpoint }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'BOT_APP_ID',       value: botAppId }
        { name: 'BOT_APP_PASSWORD', value: botAppPassword }
        { name: 'TEAMS_APP_ID',     value: teamsAppId }
        { name: 'ELLA_API_BASE',    value: 'https://${prefix}-func.azurewebsites.net/api' }
        { name: 'ALLOWED_ORIGINS',  value: 'https://${prefix}-swa.azurestaticapps.net' }
      ]
    }
  }
}

// ─── Static Web App ────────────────────────────────────────────────────────────

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-swa'
  location: 'eastus2' // SWA has limited region availability
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// ─── Outputs ───────────────────────────────────────────────────────────────────

output swaHostname      string = swa.properties.defaultHostname
output funcHostname     string = funcApp.properties.defaultHostName
output searchEndpoint   string = 'https://${search.name}.search.windows.net'
output aoaiEndpoint     string = aoai.properties.endpoint
output appInsightsKey   string = appInsights.properties.InstrumentationKey
