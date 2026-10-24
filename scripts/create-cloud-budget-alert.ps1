param(
    [string]$Project = 'project-8d23d91b-6c41-4eea-8cf',
    [string]$BillingAccount = '01954F-97A634-7345DE',
    [string]$BudgetName = 'QuickMechanic monthly guardrail',
    [string]$BudgetAmount = '1000INR'
)
$ErrorActionPreference = 'Stop'
gcloud services enable billingbudgets.googleapis.com --project=$Project --quiet
if ($LASTEXITCODE -ne 0) { throw 'Could not enable the Billing Budget API.' }

$taskExisting = gcloud billing budgets list --billing-account=$BillingAccount --filter="displayName='$BudgetName'" --format='value(name)'
if (-not $taskExisting) {
    gcloud billing budgets create --billing-account=$BillingAccount --display-name=$BudgetName --budget-amount=$BudgetAmount --calendar-period=month `
        --filter-projects="projects/$Project" `
        --threshold-rule=percent=0.50 `
        --threshold-rule=percent=0.75 `
        --threshold-rule=percent=0.90 `
        --threshold-rule=percent=1.00 --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the billing budget.' }
    Write-Host "Created $BudgetName at $BudgetAmount with 50/75/90/100 percent alerts."
} else {
    Write-Host "Budget already exists: $taskExisting"
}
