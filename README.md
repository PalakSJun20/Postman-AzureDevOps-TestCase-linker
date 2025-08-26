# Postman-AzureDevOps Test Case Linker

This project provides a Node.js automation script and sample Azure DevOps pipeline to automatically link Newman/Postman test results to Azure DevOps Test Cases using JUnit XML reports.

## Features

- Runs your Postman API tests via Newman
- Parses the JUnit XML test result
- Associates matching Azure DevOps Test Cases with automation metadata for better reporting and traceability

---

## Usage Overview

1. **Naming Your Postman Tests**
   - In your Postman test scripts, include the pattern `"TC ID: 123456 [Environment]-Test Description"` in every test name for reliable linking.

2. **Required Environment Variables**
   - Set values for the following environment variables in your pipeline or local environment:
     - `ADO_ORG`
     - `ADO_PROJECT`
     - `ADO_PAT` (see below for setup)
     - `ADO_TEST_PLAN_ID`
     - `ADO_SUITE_NAME`
     - `JUNIT_PATH` (optional; defaults to `reportDEV.xml`)

3. **Run Automation**
   - Use `run-and-update-tc.js` for local runs or the provided Azure DevOps pipeline YAML for CI integration.

---

## Setting Up Your Personal Access Token (PAT)

The PAT authenticates scripts/tools to read and update Azure DevOps Test Cases:

1. **Create a PAT in Azure DevOps**
    - Open Azure DevOps, go to User Settings → Personal Access Tokens → "New Token".
    - Name your token and select an expiration.
    - Choose the following scopes/permissions:
      - **Work Items (Read & Write)**
      - **Test Management (Read & Write)**
      - Optionally, "Project and Team (Read)" for broader access.
    - Click "Create", copy the token, and save it securely.

2. **Store and Use the PAT**
    - Treat the PAT as a password—**never commit to code**.
    - Store the token in a secure pipeline variable or as an environment variable:
      ```
      export ADO_PAT=your_pat_value
      node run-and-update-tc.js
      ```
    - In a pipeline, add a secure variable named `ADO_PAT` and map it to the environment.

3. **Security Tips**
    - Regenerate PATs regularly.
    - Remove tokens that are no longer needed.
    - Limit scope to only the access required by your automation.

4. **Reference Documentation**
    - See [Azure DevOps official docs on PATs](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops) for more details.

---

## How Does the Integration Look in Azure DevOps?

When configured correctly, your test cases will show up in Azure DevOps with automation metadata populated ("Associated Automation" tab):

**Example:**  
<img width="1906" height="342" alt="image" src="https://github.com/user-attachments/assets/977853aa-c6ab-49ab-89f6-4d2cac2cbf9d" />

<img width="625" height="255" alt="image" src="https://github.com/user-attachments/assets/c4715566-3533-420c-ae67-5de8b6c65440" />
<img width="570" height="831" alt="image" src="https://github.com/user-attachments/assets/e34e4104-bf67-4e7b-8f33-3e77c6008bc3" />


- **Automated test name:** Shows TC ID and description as per your Postman test
- **Automated test storage:** `Newman`
- **Automated test type:** `API Test`

---

## File Structure
<img width="357" height="233" alt="image" src="https://github.com/user-attachments/assets/1248aed1-6d0b-4eb8-b713-856521f6b50a" />


