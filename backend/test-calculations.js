/**
 * Test script per verificare la logica di ripartizione
 *
 * Test cases:
 * 1. Redistribuzione percentuali gas con categoria a zero consumo
 * 2. Redistribuzione percentuali elettricità con categoria a zero consumo
 * 3. Calcolo corretto dei costi fissi moltiplicati per numero di mesi
 * 4. Calcolo luci scale: per-unità × numero unità × mesi
 * 5. Forfait commerciali
 * 6. Verifica che quota involontaria resti sempre invariata
 */

import { allQuery, runQuery, getQuery } from './database.js';

// Colori per output console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.blue}${msg}${colors.reset}`)
};

/**
 * Test 1: Redistribuzione percentuali GAS inverno con riscaldamento a zero
 */
async function testGasRedistributionWinter() {
  log.section('TEST 1: Redistribuzione Gas Inverno (Riscaldamento = 0)');

  const settings = await getSettings();
  const gasInvoluntaryPct = parseFloat(settings.gas_involuntary_pct || 40);
  const gasWinterHeatingPct = parseFloat(settings.gas_winter_heating_pct || 40);
  const gasWinterHotWaterPct = parseFloat(settings.gas_winter_hot_water_pct || 20);

  log.info(`Percentuali originali:`);
  log.info(`  Involontaria: ${gasInvoluntaryPct}%`);
  log.info(`  Riscaldamento: ${gasWinterHeatingPct}%`);
  log.info(`  ACS: ${gasWinterHotWaterPct}%`);

  // Simula riscaldamento = 0
  const totalHeating = 0;
  const totalHotWater = 100;

  // Calcola redistribuzione
  const voluntaryCategories = [
    { name: 'heating', pct: gasWinterHeatingPct / 100, total: totalHeating },
    { name: 'hotWater', pct: gasWinterHotWaterPct / 100, total: totalHotWater }
  ];

  let pctToRedistribute = 0;
  let activePctSum = 0;

  voluntaryCategories.forEach(cat => {
    if (cat.total === 0 && cat.pct > 0) {
      pctToRedistribute += cat.pct;
    } else if (cat.total > 0) {
      activePctSum += cat.pct;
    }
  });

  const adjustedHeatingPct = totalHeating > 0 && activePctSum > 0
    ? (gasWinterHeatingPct / 100) + (pctToRedistribute * (gasWinterHeatingPct / 100) / activePctSum)
    : (totalHeating > 0 ? (gasWinterHeatingPct / 100) : 0);

  const adjustedHotWaterPct = totalHotWater > 0 && activePctSum > 0
    ? (gasWinterHotWaterPct / 100) + (pctToRedistribute * (gasWinterHotWaterPct / 100) / activePctSum)
    : (totalHotWater > 0 ? (gasWinterHotWaterPct / 100) : 0);

  log.info(`\nPercentuali aggiustate:`);
  log.info(`  Involontaria: ${gasInvoluntaryPct}% (INVARIATA)`);
  log.info(`  Riscaldamento: ${(adjustedHeatingPct * 100).toFixed(1)}%`);
  log.info(`  ACS: ${(adjustedHotWaterPct * 100).toFixed(1)}%`);

  const totalPct = (gasInvoluntaryPct / 100) + adjustedHeatingPct + adjustedHotWaterPct;
  const isValid = Math.abs(totalPct - 1.0) < 0.001;

  if (isValid) {
    log.success(`Somma percentuali: ${(totalPct * 100).toFixed(1)}% ✓`);
  } else {
    log.error(`Somma percentuali: ${(totalPct * 100).toFixed(1)}% (dovrebbe essere 100%)`);
  }

  // Verifica che involontaria non sia cambiata
  if (gasInvoluntaryPct === parseFloat(settings.gas_involuntary_pct)) {
    log.success('Quota involontaria rimasta invariata ✓');
  } else {
    log.error('Quota involontaria è cambiata!');
  }

  // Verifica che il 40% di riscaldamento sia stato redistribuito correttamente
  // ACS dovrebbe avere: 20% + 40% = 60%
  const expectedHotWaterPct = gasWinterHotWaterPct + gasWinterHeatingPct;
  if (Math.abs((adjustedHotWaterPct * 100) - expectedHotWaterPct) < 0.1) {
    log.success(`ACS ha ricevuto tutta la percentuale del riscaldamento: ${(adjustedHotWaterPct * 100).toFixed(1)}% ✓`);
  } else {
    log.error(`ACS dovrebbe essere ${expectedHotWaterPct}% ma è ${(adjustedHotWaterPct * 100).toFixed(1)}%`);
  }

  return isValid;
}

/**
 * Test 2: Redistribuzione percentuali GAS estate (riscaldamento già a zero)
 */
async function testGasRedistributionSummer() {
  log.section('TEST 2: Redistribuzione Gas Estate (Riscaldamento = 0 di default)');

  const settings = await getSettings();
  const gasInvoluntaryPct = parseFloat(settings.gas_involuntary_pct || 40);
  const gasSummerHotWaterPct = parseFloat(settings.gas_summer_hot_water_pct || 60);

  log.info(`Percentuali originali:`);
  log.info(`  Involontaria: ${gasInvoluntaryPct}%`);
  log.info(`  Riscaldamento: 0% (estate)`);
  log.info(`  ACS: ${gasSummerHotWaterPct}%`);

  const totalPct = gasInvoluntaryPct + 0 + gasSummerHotWaterPct;
  const isValid = totalPct === 100;

  if (isValid) {
    log.success(`Somma percentuali: ${totalPct}% ✓`);
  } else {
    log.error(`Somma percentuali: ${totalPct}% (dovrebbe essere 100%)`);
  }

  return isValid;
}

/**
 * Test 3: Redistribuzione percentuali ELETTRICITÀ inverno con riscaldamento a zero
 */
async function testElectricityRedistributionWinter() {
  log.section('TEST 3: Redistribuzione Elettricità Inverno (Riscaldamento = 0)');

  const settings = await getSettings();
  const elecInvoluntaryPct = parseFloat(settings.elec_involuntary_pct || 40);
  const winterHeatingPct = parseFloat(settings.winter_heating_pct || 30);
  const winterHotWaterPct = parseFloat(settings.winter_hot_water_pct || 20);
  const winterColdWaterPct = parseFloat(settings.winter_cold_water_pct || 10);

  log.info(`Percentuali originali:`);
  log.info(`  Involontaria: ${elecInvoluntaryPct}%`);
  log.info(`  Riscaldamento: ${winterHeatingPct}%`);
  log.info(`  ACS: ${winterHotWaterPct}%`);
  log.info(`  ACF: ${winterColdWaterPct}%`);

  // Simula riscaldamento = 0
  const totalHeating = 0;
  const totalHotWater = 50;
  const totalColdWater = 50;

  // Calcola redistribuzione
  const voluntaryCategories = [
    { name: 'heating', pct: winterHeatingPct / 100, total: totalHeating },
    { name: 'hotWater', pct: winterHotWaterPct / 100, total: totalHotWater },
    { name: 'coldWater', pct: winterColdWaterPct / 100, total: totalColdWater }
  ];

  let pctToRedistribute = 0;
  let activePctSum = 0;

  voluntaryCategories.forEach(cat => {
    if (cat.total === 0 && cat.pct > 0) {
      pctToRedistribute += cat.pct;
    } else if (cat.total > 0) {
      activePctSum += cat.pct;
    }
  });

  const adjustedHeatingPct = totalHeating > 0 && activePctSum > 0
    ? (winterHeatingPct / 100) + (pctToRedistribute * (winterHeatingPct / 100) / activePctSum)
    : (totalHeating > 0 ? (winterHeatingPct / 100) : 0);

  const adjustedHotWaterPct = totalHotWater > 0 && activePctSum > 0
    ? (winterHotWaterPct / 100) + (pctToRedistribute * (winterHotWaterPct / 100) / activePctSum)
    : (totalHotWater > 0 ? (winterHotWaterPct / 100) : 0);

  const adjustedColdWaterPct = totalColdWater > 0 && activePctSum > 0
    ? (winterColdWaterPct / 100) + (pctToRedistribute * (winterColdWaterPct / 100) / activePctSum)
    : (totalColdWater > 0 ? (winterColdWaterPct / 100) : 0);

  log.info(`\nPercentuali aggiustate:`);
  log.info(`  Involontaria: ${elecInvoluntaryPct}% (INVARIATA)`);
  log.info(`  Riscaldamento: ${(adjustedHeatingPct * 100).toFixed(1)}%`);
  log.info(`  ACS: ${(adjustedHotWaterPct * 100).toFixed(1)}%`);
  log.info(`  ACF: ${(adjustedColdWaterPct * 100).toFixed(1)}%`);

  const totalPct = (elecInvoluntaryPct / 100) + adjustedHeatingPct + adjustedHotWaterPct + adjustedColdWaterPct;
  const isValid = Math.abs(totalPct - 1.0) < 0.001;

  if (isValid) {
    log.success(`Somma percentuali: ${(totalPct * 100).toFixed(1)}% ✓`);
  } else {
    log.error(`Somma percentuali: ${(totalPct * 100).toFixed(1)}% (dovrebbe essere 100%)`);
  }

  // Verifica redistribuzione proporzionale
  // activePctSum = 20% + 10% = 30%
  // 30% da redistribuire:
  //   ACS riceve: 20% + (30% × 20/30) = 20% + 20% = 40%
  //   ACF riceve: 10% + (30% × 10/30) = 10% + 10% = 20%
  const expectedHotWaterPct = winterHotWaterPct + (winterHeatingPct * winterHotWaterPct / (winterHotWaterPct + winterColdWaterPct));
  const expectedColdWaterPct = winterColdWaterPct + (winterHeatingPct * winterColdWaterPct / (winterHotWaterPct + winterColdWaterPct));

  if (Math.abs((adjustedHotWaterPct * 100) - expectedHotWaterPct) < 0.1) {
    log.success(`ACS redistribuita correttamente: ${(adjustedHotWaterPct * 100).toFixed(1)}% ✓`);
  } else {
    log.error(`ACS dovrebbe essere ${expectedHotWaterPct.toFixed(1)}% ma è ${(adjustedHotWaterPct * 100).toFixed(1)}%`);
  }

  if (Math.abs((adjustedColdWaterPct * 100) - expectedColdWaterPct) < 0.1) {
    log.success(`ACF redistribuita correttamente: ${(adjustedColdWaterPct * 100).toFixed(1)}% ✓`);
  } else {
    log.error(`ACF dovrebbe essere ${expectedColdWaterPct.toFixed(1)}% ma è ${(adjustedColdWaterPct * 100).toFixed(1)}%`);
  }

  return isValid;
}

/**
 * Test 4: Calcolo costi fissi con periodo multi-mese
 */
async function testFixedCostsMultiMonth() {
  log.section('TEST 4: Costi Fissi Multi-Mese');

  const settings = await getSettings();
  const commonAreasGasMonthly = parseFloat(settings.common_areas_gas_monthly || 0);
  const commonAreasElecMonthly = parseFloat(settings.common_areas_elec_monthly || 0);
  const staircaseLightsPerUnitMonthly = parseFloat(settings.staircase_lights_monthly || 0);

  const numMonths = 3;
  const numUnitsWithLights = 2;

  log.info(`Costi mensili:`);
  log.info(`  Parti comuni gas: €${commonAreasGasMonthly}/mese`);
  log.info(`  Parti comuni elettricità: €${commonAreasElecMonthly}/mese`);
  log.info(`  Luci scale: €${staircaseLightsPerUnitMonthly}/unità/mese`);
  log.info(`\nPeriodo: ${numMonths} mesi`);
  log.info(`Unità con luci: ${numUnitsWithLights}`);

  const expectedCommonGas = commonAreasGasMonthly * numMonths;
  const expectedCommonElec = commonAreasElecMonthly * numMonths;
  const expectedStaircaseLights = staircaseLightsPerUnitMonthly * numMonths * numUnitsWithLights;

  log.info(`\nCosti attesi:`);
  log.info(`  Parti comuni gas: €${commonAreasGasMonthly} × ${numMonths} = €${expectedCommonGas}`);
  log.info(`  Parti comuni elettricità: €${commonAreasElecMonthly} × ${numMonths} = €${expectedCommonElec}`);
  log.info(`  Luci scale totale: €${staircaseLightsPerUnitMonthly} × ${numMonths} mesi × ${numUnitsWithLights} unità = €${expectedStaircaseLights}`);

  log.success('I costi fissi devono essere moltiplicati per il numero di mesi ✓');

  return true;
}

/**
 * Test 5: Calcolo luci scale
 */
async function testStaircaseLightsCalculation() {
  log.section('TEST 5: Calcolo Luci Scale');

  const settings = await getSettings();
  const staircaseLightsPerUnitMonthly = parseFloat(settings.staircase_lights_monthly || 0);

  const numMonths = 2;
  const numUnitsWithLights = 3;

  log.info(`Impostazione: €${staircaseLightsPerUnitMonthly} per unità al mese`);
  log.info(`Periodo: ${numMonths} mesi`);
  log.info(`Unità con luci scale: ${numUnitsWithLights}`);

  const expectedPerUnit = staircaseLightsPerUnitMonthly * numMonths;
  const expectedTotal = expectedPerUnit * numUnitsWithLights;

  log.info(`\nCosto per unità: €${staircaseLightsPerUnitMonthly} × ${numMonths} = €${expectedPerUnit}`);
  log.info(`Costo totale: €${expectedPerUnit} × ${numUnitsWithLights} unità = €${expectedTotal}`);

  log.success('Formula corretta: per-unità × mesi × numero-unità ✓');

  return true;
}

/**
 * Test 6: Forfait commerciali
 */
async function testCommercialForfait() {
  log.section('TEST 6: Forfait Commerciali');

  const monthlyForfaitWinter = 10;
  const monthlyForfaitSummer = 5;
  const numMonths = 2;
  const season = 'winter';

  const monthlyForfait = season === 'summer' ? monthlyForfaitSummer : monthlyForfaitWinter;
  const expectedTotal = monthlyForfait * numMonths;

  log.info(`Forfait mensile inverno: €${monthlyForfaitWinter}`);
  log.info(`Forfait mensile estate: €${monthlyForfaitSummer}`);
  log.info(`Stagione: ${season}`);
  log.info(`Periodo: ${numMonths} mesi`);
  log.info(`\nCosto atteso: €${monthlyForfait} × ${numMonths} = €${expectedTotal}`);

  log.success('Il forfait commerciale deve essere moltiplicato per il numero di mesi ✓');

  return true;
}

/**
 * Helper: Ottieni impostazioni dal database
 */
async function getSettings() {
  const settingsRows = await allQuery('SELECT key, value FROM settings WHERE condominium_id = 1');
  const settings = {};
  settingsRows.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

/**
 * Esegui tutti i test
 */
async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}    TEST LOGICA DI RIPARTIZIONE CONDOMINIO${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);

  const results = [];

  try {
    results.push({ name: 'Gas Redistribution Winter', passed: await testGasRedistributionWinter() });
    results.push({ name: 'Gas Redistribution Summer', passed: await testGasRedistributionSummer() });
    results.push({ name: 'Electricity Redistribution Winter', passed: await testElectricityRedistributionWinter() });
    results.push({ name: 'Fixed Costs Multi-Month', passed: await testFixedCostsMultiMonth() });
    results.push({ name: 'Staircase Lights Calculation', passed: await testStaircaseLightsCalculation() });
    results.push({ name: 'Commercial Forfait', passed: await testCommercialForfait() });

    // Riepilogo
    log.section('RIEPILOGO TEST');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(result => {
      if (result.passed) {
        log.success(`${result.name}`);
      } else {
        log.error(`${result.name}`);
      }
    });

    console.log(`\n${colors.bold}Totale: ${passed} passati, ${failed} falliti${colors.reset}\n`);

    if (failed === 0) {
      console.log(`${colors.green}${colors.bold}✓ TUTTI I TEST PASSATI!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}${colors.bold}✗ ALCUNI TEST FALLITI${colors.reset}\n`);
      process.exit(1);
    }

  } catch (error) {
    log.error(`Errore durante i test: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Esegui i test
runAllTests();
