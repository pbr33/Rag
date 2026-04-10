#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Creates the three AI Search indexes for ELLA Square.
# Each index has:
#   - content field (full-text, searchable)
#   - contentVector field (float32[1536], HNSW, for vector search)
#   - sourceName, sourceUrl, label, domainId, chunkIndex, pageNumber metadata
#   - Semantic configuration "ella-semantic" with content as primary field
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SEARCH_ENDPOINT="${1:?Usage: setup-search-indexes.sh <search-endpoint>}"
SEARCH_KEY=$(az search admin-key show \
  --service-name "$(basename "${SEARCH_ENDPOINT%.search.windows.net}" | sed 's/https:\/\///')" \
  --resource-group "${RG_NAME}" \
  --query "primaryKey" --output tsv)

INDEX_SCHEMA=$(cat << 'EOF'
{
  "fields": [
    { "name": "id",            "type": "Edm.String",       "key": true,  "filterable": true },
    { "name": "content",       "type": "Edm.String",       "searchable": true, "retrievable": true, "analyzer": "en.lucene" },
    { "name": "contentVector", "type": "Collection(Edm.Single)", "searchable": true, "retrievable": false,
      "dimensions": 1536, "vectorSearchProfile": "ella-hnsw-profile" },
    { "name": "sourceName",    "type": "Edm.String",       "filterable": true, "retrievable": true },
    { "name": "sourceUrl",     "type": "Edm.String",       "retrievable": true },
    { "name": "label",         "type": "Edm.String",       "filterable": true, "retrievable": true },
    { "name": "domainId",      "type": "Edm.String",       "filterable": true, "retrievable": true },
    { "name": "chunkIndex",    "type": "Edm.Int32",        "retrievable": true },
    { "name": "pageNumber",    "type": "Edm.Int32",        "retrievable": true }
  ],
  "vectorSearch": {
    "algorithms": [{ "name": "ella-hnsw", "kind": "hnsw", "hnswParameters": { "m": 4, "efConstruction": 400, "efSearch": 500, "metric": "cosine" } }],
    "profiles":   [{ "name": "ella-hnsw-profile", "algorithm": "ella-hnsw" }]
  },
  "semantic": {
    "configurations": [{
      "name": "ella-semantic",
      "prioritizedFields": {
        "contentFields":    [{ "fieldName": "content" }],
        "keywordsFields":   [{ "fieldName": "sourceName" }]
      }
    }]
  }
}
EOF
)

for DOMAIN in finance hr legal; do
  INDEX_NAME="ella-${DOMAIN}"
  PAYLOAD=$(echo "${INDEX_SCHEMA}" | jq --arg n "${INDEX_NAME}" '. + {"name": $n}')

  echo "  Creating index ${INDEX_NAME}..."
  curl -s -X PUT \
    "${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}?api-version=2024-05-01-preview" \
    -H "Content-Type: application/json" \
    -H "api-key: ${SEARCH_KEY}" \
    -d "${PAYLOAD}" \
    | jq '.name // .error'
done

echo "✅ AI Search indexes created."
