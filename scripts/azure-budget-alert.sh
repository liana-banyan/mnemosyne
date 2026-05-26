#!/bin/bash
# azure-budget-alert.sh
# Sets Azure consumption budget alerts for the Liana Banyan signing resource group.
# $10/month WARNING · $20/month CRITICAL
# Canon: K-C · BP058 W6 · Azure Artifact Signing prestage
#
# Prerequisites:
#   - Azure CLI installed: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
#   - Logged in: az login (or service principal)
#   - Subscription ID set in AZURE_SUBSCRIPTION_ID env var OR passed as argument
#
# Usage:
#   bash scripts/azure-budget-alert.sh
#   AZURE_SUBSCRIPTION_ID=<sub-id> bash scripts/azure-budget-alert.sh

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────────
RESOURCE_GROUP="rg-liana-banyan-signing"
BUDGET_NAME="liana-banyan-signing-budget"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
FOUNDER_EMAIL="founder@lianabanyan.com"
MONTHLY_LIMIT=20         # hard cap for budget (critical threshold)
WARNING_THRESHOLD=10     # warning at $10/month
CRITICAL_THRESHOLD=20    # critical at $20/month

# ── Validate prerequisites ──────────────────────────────────────────────────────────

if ! command -v az &>/dev/null; then
  echo "ERROR: Azure CLI (az) not found."
  echo "Install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi

# Check login status without echoing secrets
if ! az account show &>/dev/null; then
  echo "Not logged in to Azure CLI. Running az login..."
  az login
fi

if [[ -z "$SUBSCRIPTION_ID" ]]; then
  # Try to pull from current az account context
  SUBSCRIPTION_ID=$(az account show --query id -o tsv 2>/dev/null || true)
  if [[ -z "$SUBSCRIPTION_ID" ]]; then
    echo "ERROR: AZURE_SUBSCRIPTION_ID not set and could not detect from az account."
    echo "Set it: export AZURE_SUBSCRIPTION_ID=<your-subscription-id>"
    exit 1
  fi
  echo "Using subscription from az context: ${SUBSCRIPTION_ID:0:8}..."
fi

echo "Subscription: ${SUBSCRIPTION_ID:0:8}..."
echo "Resource group: $RESOURCE_GROUP"
echo "Budget name: $BUDGET_NAME"
echo "Monthly limit: \$$MONTHLY_LIMIT"
echo "Warning at: \$$WARNING_THRESHOLD/month"
echo "Critical at: \$$CRITICAL_THRESHOLD/month"
echo "Alert email: $FOUNDER_EMAIL"
echo ""

# ── Compute budget period (current month start → next year same date) ───────────────
START_DATE=$(date -u +"%Y-%m-01")
END_DATE=$(date -u -d "+1 year" +"%Y-%m-01" 2>/dev/null || date -u -v+1y +"%Y-%m-01")

echo "Budget period: $START_DATE → $END_DATE"
echo ""

# ── Create budget with alert notifications ─────────────────────────────────────────
echo "Creating Azure consumption budget..."

az consumption budget create \
  --budget-name "$BUDGET_NAME" \
  --amount "$MONTHLY_LIMIT" \
  --time-grain Monthly \
  --start-date "$START_DATE" \
  --end-date "$END_DATE" \
  --resource-group "$RESOURCE_GROUP" \
  --subscription "$SUBSCRIPTION_ID" \
  --notifications \
    "Warning:Actual:${WARNING_THRESHOLD}:EmailAddress:${FOUNDER_EMAIL}" \
    "Critical:Actual:${CRITICAL_THRESHOLD}:EmailAddress:${FOUNDER_EMAIL}" \
  2>&1

echo ""
echo "Budget alert created successfully."
echo ""
echo "Summary:"
echo "  Budget: $BUDGET_NAME on rg: $RESOURCE_GROUP"
echo "  ⚠️  WARNING email at \$$WARNING_THRESHOLD/month → $FOUNDER_EMAIL"
echo "  🔴 CRITICAL email at \$$CRITICAL_THRESHOLD/month → $FOUNDER_EMAIL"
echo ""
echo "Azure Artifact Signing Basic Tier is \$9.99/month flat."
echo "A WARNING alert would only fire if overage charges accumulate."
echo "A CRITICAL alert at \$20 would indicate ~2,000+ overage signatures — unusual."
echo ""
echo "To verify the budget was created:"
echo "  az consumption budget list --resource-group $RESOURCE_GROUP"
