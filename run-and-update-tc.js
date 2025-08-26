/**
 * File: run-and-update-tc.js
 * Purpose: Parse JUnit XML test results and update Azure DevOps test case automation metadata.
 * Enhancements: Validates environment, masks secrets in logs, provides summary report, robust edge case handling.
 * Author: @PalakSoni
 * Version: 1.0.0
 * Date: 2023-10-30
 */

const fs = require('fs');
const xml2js = require('xml2js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// --- ENVIRONMENT VALIDATION ---
const envVars = [
  'ADO_ORG', 'ADO_PROJECT', 'ADO_PAT', 'ADO_TEST_PLAN_ID', 'ADO_SUITE_NAME'
];
const missing = envVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// -- CONFIGURATION ---
const org = process.env.ADO_ORG;
const project = process.env.ADO_PROJECT;
const pat = process.env.ADO_PAT;
const planId = process.env.ADO_TEST_PLAN_ID;
const suiteName = process.env.ADO_SUITE_NAME;
const junitPath = process.env.JUNIT_PATH || 'reportDEV.xml';

// --- SECURITY: MASK SECRETS IN LOGS ---
function maskSecret(str) {
  if (!str) return '';
  return str.length > 6
    ? str.slice(0, 2) + '***' + str.slice(-2)
    : '***';
}

const auth = Buffer.from(`:${pat}`).toString('base64');
const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Basic ${auth}`
};

// --- HELPERS ---
function logApiError(context, err) {
  const urlMasked = context.replace(pat, maskSecret(pat));
  const msg = err.response?.data?.message || err.message;
  console.error(`❌ Error while ${urlMasked}: ${msg}`);
}

async function getSuiteIdByName(planId, suiteName) {
  console.log(`🔍 Resolving suite name "${suiteName}" under plan ${planId}...`);
  const url = `https://dev.azure.com/${org}/${project}/_apis/test/plans/${planId}/suites`;
  try {
    const res = await axios.get(url, { headers });
    const suite = res.data.value.find(s => s.name === suiteName);
    if (!suite) throw new Error(`Suite with name "${suiteName}" not found.`);
    console.log(`✅ Found suite ID: ${suite.id}`);
    return suite.id;
  } catch (err) {
    logApiError(`fetching Test suites at ${maskSecret(url)}`, err);
    throw err;
  }
}

async function getTestPointMap(planId, suiteId) {
  const pointsUrl = `https://dev.azure.com/${org}/${project}/_apis/test/plans/${planId}/suites/${suiteId}/points?api-version=7.0`;
  try {
    const res = await axios.get(pointsUrl, { headers });
    return res.data.value.map(p => ({ testCaseId: p.testCase.id, pointId: p.id }));
  } catch (err) {
    logApiError(`fetching test points at ${maskSecret(pointsUrl)}`, err);
    throw err;
  }
}

function printSummary(summary) {
  console.log('\n=== Summary Report ===');
  console.log(`Total test cases processed: ${summary.total}`);
  console.log(`Successfully updated: ${summary.success}`);
  if (summary.failed) console.log(`Failed updates: ${summary.failed}`);
  if (summary.skipped) console.log(`Skipped: ${summary.skipped}`);
  console.log('=====================');
}

// MAIN FUNCTION
async function main() {
  let summary = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0
  };

  console.log("📄 Parsing JUnit XML file:", junitPath);
  let xml;
  try {
    xml = fs.readFileSync(junitPath, 'utf8');
  } catch (err) {
    console.error(`❌ Failed to read JUnit file "${junitPath}": ${err.message}`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = await xml2js.parseStringPromise(xml);
  } catch (err) {
    console.error("❌ Failed to parse JUnit XML:", err.message);
    process.exit(1);
  }

  let testcases = [];
  if (parsed.testsuite?.testcase) {
    testcases = parsed.testsuite.testcase;
  } else if (parsed.testsuites?.testsuite) {
    for (const suite of parsed.testsuites.testsuite) {
      if (suite.testcase) testcases.push(...suite.testcase);
    }
  }

  // --- EDGE CASE: No Test Cases Found ---
  if (!testcases.length) {
    console.warn("⚠️ No test cases found in JUnit file.");
    summary.skipped = 1;
    printSummary(summary);
    process.exit(0);
  }

  // Extract TC Information
  const tests = testcases.map(tc => {
    const name = tc.$.name || '';
    const match = name.match(/TC ID:\s*(\d{6,})/i);
    if (!match) return null;
    const hasFailure = tc.failure || tc.error;
    return {
      id: Number(match[1]),
      name,
      outcome: hasFailure ? 'Failed' : 'Passed'
    };
  }).filter(Boolean);

  if (!tests.length) {
    console.warn("⚠️ No TC ID found in any test case. Skipping Azure DevOps update.");
    summary.skipped = testcases.length;
    printSummary(summary);
    return;
  }
  summary.total = tests.length;

  // Get suite ID and test points
  let suiteId;
  try {
    suiteId = await getSuiteIdByName(planId, suiteName);
  } catch (err) {
    summary.skipped = tests.length;
    printSummary(summary);
    return;
  }

  console.log("🔗 TC IDs extracted:", tests.map(t => t.id));
  console.log(`🔎 Fetching valid test points from plan ${planId}, suite ${suiteId}`);
  let testCasePointMap;
  try {
    testCasePointMap = await getTestPointMap(planId, suiteId);
  } catch (err) {
    summary.skipped = tests.length;
    printSummary(summary);
    return;
  }

  const pointIds = testCasePointMap
    .filter(p => tests.find(t => t.id === p.testCaseId))
    .map(p => p.pointId);

  if (!pointIds.length) {
    console.warn("⚠️ No valid test case IDs matched in Azure DevOps suite. Proceeding to update test case metadata only.");
  }

  // Patch each TC work item
  for (const t of tests) {
    try {
      const guid = uuidv4();
      // First PATCH: Set associated automation fields
      await axios.patch(
        `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/${t.id}?api-version=7.0`,
        [
          { op: 'add', path: '/fields/Microsoft.VSTS.TCM.AutomatedTestId', value: guid },
          { op: 'add', path: '/fields/Microsoft.VSTS.TCM.AutomatedTestName', value: t.name },
          { op: 'add', path: '/fields/Microsoft.VSTS.TCM.AutomatedTestStorage', value: 'Newman' },
          { op: 'add', path: '/fields/Microsoft.VSTS.TCM.AutomatedTestType', value: 'API Test' }
        ],
        { headers: { ...headers, 'Content-Type': 'application/json-patch+json' } }
      );

      // Second PATCH: Trigger ADO to auto-set Automation Status by re-saving test case
      await axios.patch(
        `https://dev.azure.com/${org}/${project}/_apis/wit/workitems/${t.id}?api-version=7.0`,
        [
          { op: 'add', path: '/fields/System.ChangedDate', value: new Date().toISOString() }
        ],
        { headers: { ...headers, 'Content-Type': 'application/json-patch+json' } }
      );
      console.log(`\u2705 Work item ${t.id} updated.`);
      summary.success += 1;
    } catch (err) {
      logApiError(`updating TC ${t.id}`, err);
      summary.failed += 1;
    }
  }
  console.log("🎉 ADO automation metadata sync completed!");
  // SUMMARY REPORT
  printSummary(summary);
}

main();
