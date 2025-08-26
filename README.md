# Postman-AzureDevOps Test Case Linker

This project provides a Node.js automation script and sample CI pipeline to automatically link Newman/Postman test case execution to Azure DevOps Test Cases using JUnit XML output.

See ci-pipeline.yml for Azure DevOps integration.

## Features

- Runs your Postman API tests via Newman
- Parses JUnit XML test result
- Updates matching Azure DevOps Test Cases with automation metadata for traceable, automated test reporting

## Usage (Summary)

- Put `"TC ID: 100001 [Name]"` in every test name (in your Postman scripts)
- Set required ADO environment variables
- Run in Azure DevOps with provided pipeline YAML, or locally with Node.js

## Files

- `run-and-update-tc.js` — Node.js script for linking to Azure DevOps
- `ci-pipeline.yml` — Example YAML for running in Azure Pipelines
- `sample.postman_collection.json` — Demo Postman Collection file you can adapt
- `postman_env.json` — Sample environment file
