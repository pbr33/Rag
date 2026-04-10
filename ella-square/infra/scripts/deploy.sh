#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ELLA Square — full deployment script
# Prerequisites: az cli, func cli, node 20, jq
# Usage:
#   export ENV_NAME=dev
#   export RG_NAME=ella-square-rg
#   export LOCATION=eastus
#   export BOT_APP_ID=<your-bot-aad-app-id>
#   export BOT_APP_PASSWORD=<your-bot-client-secret>
#   export TEAMS_APP_ID=<your-teams-app-id>
#   ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_NAME="${ENV_NAME:-dev}"
RG_NAME="${RG_NAME:-ella-square-rg}"
LOCATION="${LOCATION:-eastus}"

echo "▶ Creating resource group ${RG_NAME}..."
az group create --name "${RG_NAME}" --location "${LOCATION}" --output none

echo "▶ Deploying Bicep infrastructure..."
OUTPUTS=$(az deployment group create \
  --resource-group "${RG_NAME}" \
  --template-file "$(dirname "$0")/../bicep/main.bicep" \
  --parameters \
    envName="${ENV_NAME}" \
    location="${LOCATION}" \
    botAppId="${BOT_APP_ID}" \
    botAppPassword="${BOT_APP_PASSWORD}" \
    teamsAppId="${TEAMS_APP_ID}" \
  --query "properties.outputs" \
  --output json)

SWA_HOSTNAME=$(echo "${OUTPUTS}" | jq -r '.swaHostname.value')
FUNC_HOSTNAME=$(echo "${OUTPUTS}" | jq -r '.funcHostname.value')
SEARCH_ENDPOINT=$(echo "${OUTPUTS}" | jq -r '.searchEndpoint.value')
FUNC_APP_NAME="ella-${ENV_NAME}-func"
SWA_NAME="ella-${ENV_NAME}-swa"

echo "  SWA:    https://${SWA_HOSTNAME}"
echo "  Func:   https://${FUNC_HOSTNAME}"
echo "  Search: ${SEARCH_ENDPOINT}"

# ─── Create AI Search indexes ──────────────────────────────────────────────────

echo "▶ Creating AI Search indexes..."
"$(dirname "$0")/setup-search-indexes.sh" "${SEARCH_ENDPOINT}"

# ─── Deploy Azure Functions ────────────────────────────────────────────────────

echo "▶ Building and deploying Functions app..."
pushd "$(dirname "$0")/../../api" > /dev/null
npm ci --prefer-offline
npm run build
func azure functionapp publish "${FUNC_APP_NAME}" --typescript
popd > /dev/null

echo "▶ Building and deploying Bot..."
pushd "$(dirname "$0")/../../bot" > /dev/null
npm ci --prefer-offline
npm run build
func azure functionapp publish "${FUNC_APP_NAME}" --typescript
popd > /dev/null

# ─── Deploy Static Web App ─────────────────────────────────────────────────────

echo "▶ Building React Teams tab..."
pushd "$(dirname "$0")/../../teams-app" > /dev/null
npm ci --prefer-offline
npm run build
popd > /dev/null

SWA_TOKEN=$(az staticwebapp secrets list \
  --name "${SWA_NAME}" \
  --resource-group "${RG_NAME}" \
  --query "properties.apiKey" \
  --output tsv)

npx @azure/static-web-apps-cli deploy \
  "$(dirname "$0")/../../teams-app/dist" \
  --env production \
  --api-location "$(dirname "$0")/../../api" \
  --deployment-token "${SWA_TOKEN}"

# ─── Package Teams manifest ────────────────────────────────────────────────────

echo "▶ Packaging Teams manifest..."
MANIFEST_DIR="$(dirname "$0")/../../manifest"
sed -i \
  -e "s/{{TEAMS_APP_ID}}/${TEAMS_APP_ID}/g" \
  -e "s/{{BOT_APP_ID}}/${BOT_APP_ID}/g" \
  -e "s/{{SWA_HOSTNAME}}/${SWA_HOSTNAME}/g" \
  "${MANIFEST_DIR}/manifest.json"

cd "${MANIFEST_DIR}"
zip -r "../ella-square-teams-app.zip" manifest.json assets/

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Upload ella-square-teams-app.zip to Teams Admin Centre → Manage apps → Upload"
echo "     or install directly in a team with: https://teams.microsoft.com/_#/l/app/${TEAMS_APP_ID}"
echo "  2. Add the bot to a channel and @mention it to test"
echo "  3. Open ELLA Square from your Teams personal app list"
