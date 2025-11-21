import { calculateMonthlySplit } from '../utils/calculator.js';
import { allQuery, getQuery } from '../database.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Esegue lo script di test delle logiche di calcolo
 * Solo per amministratori
 */
export const runCalculationTests = async (req, res) => {
  try {
    // Verifica che l'utente sia admin o super_admin
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Solo gli amministratori possono eseguire i test' });
    }

    console.log(`\n🧪 TEST EXECUTION REQUEST from user: ${req.user.username}`);

    // Percorso dello script di test
    const testScriptPath = path.join(__dirname, '..', 'test-calculations.js');

    try {
      // Esegui lo script di test e cattura l'output
      const output = execSync(`node "${testScriptPath}"`, {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..'),
        timeout: 30000 // 30 secondi timeout
      });

      // I test sono passati (exit code 0)
      res.json({
        success: true,
        output: output,
        message: 'Tutti i test sono passati con successo!'
      });

    } catch (error) {
      // I test sono falliti (exit code != 0) o timeout
      res.json({
        success: false,
        output: error.stdout || error.stderr || error.message,
        message: 'Alcuni test sono falliti',
        error: error.message
      });
    }

  } catch (error) {
    console.error('Errore esecuzione test:', error);
    res.status(500).json({
      success: false,
      error: 'Errore durante l\'esecuzione dei test',
      details: error.message
    });
  }
};

/**
 * Debug endpoint - fornisce dettaglio completo dei calcoli
 * Solo per amministratori
 */
export const getDebugCalculation = async (req, res) => {
  try {
    const { dateFrom, dateTo, type = 'both' } = req.query;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom e dateTo sono obbligatori' });
    }

    // Verifica che l'utente sia admin o super_admin
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Solo gli amministratori possono accedere al debug' });
    }

    console.log(`\n🔍 DEBUG CALCULATION REQUEST`);
    console.log(`📅 Period: ${dateFrom} to ${dateTo}`);
    console.log(`📊 Type: ${type}`);

    // Calcola le date e il numero di mesi
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12
                     + (endDate.getMonth() - startDate.getMonth()) + 1;
    const numMonths = Math.max(1, monthsDiff);

    // Ottieni i dati completi del calcolo
    const calculationData = await calculateMonthlySplit(dateFrom, dateTo, type);

    // Ottieni le impostazioni dal database
    const settingsRows = await allQuery('SELECT key, value FROM settings WHERE condominium_id = 1');
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    // Ottieni le bollette del periodo
    const gasBills = await allQuery(
      `SELECT * FROM bills
       WHERE condominium_id = 1
       AND type = 'gas'
       AND bill_period_start <= ?
       AND bill_period_end >= ?`,
      [dateTo, dateFrom]
    );

    const elecBills = await allQuery(
      `SELECT * FROM bills
       WHERE condominium_id = 1
       AND type = 'electricity'
       AND bill_period_start <= ?
       AND bill_period_end >= ?`,
      [dateTo, dateFrom]
    );

    const totalGasCost = gasBills.reduce((sum, bill) => sum + bill.amount, 0);
    const totalElecCost = elecBills.reduce((sum, bill) => sum + bill.amount, 0);

    // Prepara il debug dettagliato
    const debug = {
      period: {
        from: dateFrom,
        to: dateTo,
        numMonths: numMonths,
        season: calculationData.season
      },
      bills: {
        gas: {
          total: totalGasCost,
          count: gasBills.length,
          bills: gasBills.map(b => ({
            date: b.bill_date,
            amount: b.amount,
            period: `${b.bill_period_start} - ${b.bill_period_end}`
          }))
        },
        electricity: {
          total: totalElecCost,
          count: elecBills.length,
          bills: elecBills.map(b => ({
            date: b.bill_date,
            amount: b.amount,
            period: `${b.bill_period_start} - ${b.bill_period_end}`
          }))
        }
      },
      settings: {
        gas: {
          involuntary_pct: parseFloat(settings.gas_involuntary_pct || 40),
          winter_heating_pct: parseFloat(settings.gas_winter_heating_pct || 40),
          winter_hot_water_pct: parseFloat(settings.gas_winter_hot_water_pct || 20),
          summer_hot_water_pct: parseFloat(settings.gas_summer_hot_water_pct || 60),
          common_areas_monthly: parseFloat(settings.common_areas_gas_monthly || 0)
        },
        electricity: {
          involuntary_pct: parseFloat(settings.elec_involuntary_pct || 40),
          winter_heating_pct: parseFloat(settings.winter_heating_pct || 30),
          winter_hot_water_pct: parseFloat(settings.winter_hot_water_pct || 20),
          winter_cold_water_pct: parseFloat(settings.winter_cold_water_pct || 10),
          summer_cooling_pct: parseFloat(settings.summer_cooling_pct || 20),
          summer_hot_water_pct: parseFloat(settings.summer_hot_water_pct || 20),
          summer_cold_water_pct: parseFloat(settings.summer_cold_water_pct || 20),
          common_areas_monthly: parseFloat(settings.common_areas_elec_monthly || 0),
          staircase_lights_monthly_per_unit: parseFloat(settings.staircase_lights_monthly || 0)
        },
        season: {
          summer_start_month: parseInt(settings.summer_start_month || 6),
          summer_end_month: parseInt(settings.summer_end_month || 9)
        }
      },
      fixedCosts: {
        gas: {
          common_areas_monthly: parseFloat(settings.common_areas_gas_monthly || 0),
          common_areas_total: parseFloat(settings.common_areas_gas_monthly || 0) * numMonths
        },
        electricity: {
          common_areas_monthly: parseFloat(settings.common_areas_elec_monthly || 0),
          common_areas_total: parseFloat(settings.common_areas_elec_monthly || 0) * numMonths,
          staircase_lights_per_unit_monthly: parseFloat(settings.staircase_lights_monthly || 0),
          staircase_lights_per_unit_total: parseFloat(settings.staircase_lights_monthly || 0) * numMonths,
          num_units_with_lights: calculationData.units.filter(u => u.has_staircase_lights).length,
          staircase_lights_total: parseFloat(settings.staircase_lights_monthly || 0) * numMonths * calculationData.units.filter(u => u.has_staircase_lights).length
        }
      },
      gasCalculation: null,
      electricityCalculation: null,
      units: calculationData.units.map(unit => ({
        unit_number: unit.unit_number,
        unit_name: unit.unit_name,
        surface_area: unit.surface_area,
        is_inhabited: unit.is_inhabited,
        is_commercial: unit.is_commercial,
        has_staircase_lights: unit.has_staircase_lights,
        consumptions: {
          heating: unit.heating || 0,
          hot_water: unit.hot_water || 0,
          cooling: unit.cooling || 0,
          cold_water: unit.cold_water || 0
        },
        costs: unit.costs,
        readings: unit.readings
      })),
      verification: {
        total_from_calculation: calculationData.total_cost,
        total_from_bills: totalGasCost + totalElecCost,
        difference: Math.abs(calculationData.total_cost - (totalGasCost + totalElecCost)),
        matches: Math.abs(calculationData.total_cost - (totalGasCost + totalElecCost)) < 0.01
      }
    };

    // Calcola dettaglio GAS se richiesto
    if (type === 'gas' || type === 'both') {
      const gasInvoluntaryPct = parseFloat(settings.gas_involuntary_pct || 40) / 100;
      const commonAreasCost = parseFloat(settings.common_areas_gas_monthly || 0) * numMonths;
      const remainingGas = totalGasCost - commonAreasCost;
      const involuntaryCost = remainingGas * gasInvoluntaryPct;

      let heatingPct, hotWaterPct;
      if (calculationData.season === 'winter') {
        heatingPct = parseFloat(settings.gas_winter_heating_pct || 40) / 100;
        hotWaterPct = parseFloat(settings.gas_winter_hot_water_pct || 20) / 100;
      } else {
        heatingPct = 0;
        hotWaterPct = parseFloat(settings.gas_summer_hot_water_pct || 60) / 100;
      }

      // Calcola consumi totali
      const totalHeating = calculationData.units.reduce((sum, u) => sum + (u.heating || 0), 0);
      const totalHotWater = calculationData.units.reduce((sum, u) => sum + (u.hot_water || 0), 0);

      // Identifica categorie con zero consumi
      const voluntaryCategories = [
        { name: 'heating', pct: heatingPct, total: totalHeating },
        { name: 'hotWater', pct: hotWaterPct, total: totalHotWater }
      ];

      let pctToRedistribute = 0;
      let activePctSum = 0;
      const zeroConsumptionCategories = [];

      voluntaryCategories.forEach(cat => {
        if (cat.total === 0 && cat.pct > 0) {
          pctToRedistribute += cat.pct;
          zeroConsumptionCategories.push(cat.name);
        } else if (cat.total > 0) {
          activePctSum += cat.pct;
        }
      });

      // Calcola percentuali aggiustate
      const adjustedHeatingPct = totalHeating > 0 && activePctSum > 0
        ? heatingPct + (pctToRedistribute * heatingPct / activePctSum)
        : (totalHeating > 0 ? heatingPct : 0);

      const adjustedHotWaterPct = totalHotWater > 0 && activePctSum > 0
        ? hotWaterPct + (pctToRedistribute * hotWaterPct / activePctSum)
        : (totalHotWater > 0 ? hotWaterPct : 0);

      debug.gasCalculation = {
        total: totalGasCost,
        common_areas_cost: commonAreasCost,
        remaining_after_common: remainingGas,
        involuntary: {
          percentage: gasInvoluntaryPct * 100,
          cost: involuntaryCost,
          note: 'Distribuita per superficie tra unità abitate'
        },
        voluntary: {
          total_percentage: (heatingPct + hotWaterPct) * 100,
          remaining_cost: remainingGas - involuntaryCost,
          categories: {
            heating: {
              original_pct: heatingPct * 100,
              adjusted_pct: adjustedHeatingPct * 100,
              total_consumption: totalHeating,
              cost: (remainingGas - involuntaryCost) * adjustedHeatingPct,
              has_consumption: totalHeating > 0
            },
            hot_water: {
              original_pct: hotWaterPct * 100,
              adjusted_pct: adjustedHotWaterPct * 100,
              total_consumption: totalHotWater,
              cost: (remainingGas - involuntaryCost) * adjustedHotWaterPct,
              has_consumption: totalHotWater > 0
            }
          },
          redistribution: {
            active: pctToRedistribute > 0,
            pct_redistributed: pctToRedistribute * 100,
            zero_consumption_categories: zeroConsumptionCategories,
            note: pctToRedistribute > 0
              ? `Il ${(pctToRedistribute * 100).toFixed(0)}% delle categorie senza consumo è stato redistribuito proporzionalmente alle altre categorie volontarie`
              : 'Nessuna redistribuzione necessaria'
          }
        },
        verification: {
          sum_percentages: (gasInvoluntaryPct + adjustedHeatingPct + adjustedHotWaterPct) * 100,
          should_be_100: Math.abs((gasInvoluntaryPct + adjustedHeatingPct + adjustedHotWaterPct) - 1.0) < 0.001
        }
      };
    }

    // Calcola dettaglio ELETTRICITÀ se richiesto
    if (type === 'electricity' || type === 'both') {
      const elecInvoluntaryPct = parseFloat(settings.elec_involuntary_pct || 40) / 100;
      const commonAreasCost = parseFloat(settings.common_areas_elec_monthly || 0) * numMonths;
      const staircaseLightsPerUnit = parseFloat(settings.staircase_lights_monthly || 0) * numMonths;
      const numUnitsWithLights = calculationData.units.filter(u => u.has_staircase_lights).length;
      const staircaseLightsTotal = staircaseLightsPerUnit * numUnitsWithLights;

      // Calcola forfait commerciali
      const commercialWaterTotal = calculationData.units
        .filter(u => u.is_commercial && u.is_inhabited)
        .reduce((sum, u) => {
          const monthlyForfait = calculationData.season === 'summer'
            ? (u.monthly_elec_fixed_summer || 0)
            : (u.monthly_elec_fixed_winter || 0);
          return sum + (monthlyForfait * numMonths);
        }, 0);

      const remainingElec = totalElecCost - commonAreasCost - staircaseLightsTotal - commercialWaterTotal;
      const involuntaryCost = remainingElec * elecInvoluntaryPct;

      let heatingPct, coolingPct, hotWaterPct, coldWaterPct;
      if (calculationData.season === 'winter') {
        heatingPct = parseFloat(settings.winter_heating_pct || 30) / 100;
        coolingPct = 0;
        hotWaterPct = parseFloat(settings.winter_hot_water_pct || 20) / 100;
        coldWaterPct = parseFloat(settings.winter_cold_water_pct || 10) / 100;
      } else {
        heatingPct = 0;
        coolingPct = parseFloat(settings.summer_cooling_pct || 20) / 100;
        hotWaterPct = parseFloat(settings.summer_hot_water_pct || 20) / 100;
        coldWaterPct = parseFloat(settings.summer_cold_water_pct || 20) / 100;
      }

      // Calcola consumi totali
      const totalHeating = calculationData.units.reduce((sum, u) => sum + (u.heating || 0), 0);
      const totalCooling = calculationData.units.reduce((sum, u) => sum + (u.cooling || 0), 0);
      const totalHotWater = calculationData.units.reduce((sum, u) => sum + (u.hot_water || 0), 0);
      const totalColdWater = calculationData.units.reduce((sum, u) => sum + (u.cold_water || 0), 0);

      // Identifica categorie con zero consumi
      const voluntaryCategories = [
        { name: 'heating', pct: heatingPct, total: totalHeating },
        { name: 'cooling', pct: coolingPct, total: totalCooling },
        { name: 'hotWater', pct: hotWaterPct, total: totalHotWater },
        { name: 'coldWater', pct: coldWaterPct, total: totalColdWater }
      ];

      let pctToRedistribute = 0;
      let activePctSum = 0;
      const zeroConsumptionCategories = [];

      voluntaryCategories.forEach(cat => {
        if (cat.total === 0 && cat.pct > 0) {
          pctToRedistribute += cat.pct;
          zeroConsumptionCategories.push(cat.name);
        } else if (cat.total > 0) {
          activePctSum += cat.pct;
        }
      });

      // Calcola percentuali aggiustate
      const adjustedHeatingPct = totalHeating > 0 && activePctSum > 0
        ? heatingPct + (pctToRedistribute * heatingPct / activePctSum)
        : (totalHeating > 0 ? heatingPct : 0);

      const adjustedCoolingPct = totalCooling > 0 && activePctSum > 0
        ? coolingPct + (pctToRedistribute * coolingPct / activePctSum)
        : (totalCooling > 0 ? coolingPct : 0);

      const adjustedHotWaterPct = totalHotWater > 0 && activePctSum > 0
        ? hotWaterPct + (pctToRedistribute * hotWaterPct / activePctSum)
        : (totalHotWater > 0 ? hotWaterPct : 0);

      const adjustedColdWaterPct = totalColdWater > 0 && activePctSum > 0
        ? coldWaterPct + (pctToRedistribute * coldWaterPct / activePctSum)
        : (totalColdWater > 0 ? coldWaterPct : 0);

      debug.electricityCalculation = {
        total: totalElecCost,
        common_areas_cost: commonAreasCost,
        staircase_lights: {
          per_unit_monthly: parseFloat(settings.staircase_lights_monthly || 0),
          per_unit_total: staircaseLightsPerUnit,
          num_units: numUnitsWithLights,
          total_cost: staircaseLightsTotal
        },
        commercial_water_forfait: {
          total_cost: commercialWaterTotal,
          note: 'Forfait per unità commerciali abitate'
        },
        remaining_after_deductions: remainingElec,
        involuntary: {
          percentage: elecInvoluntaryPct * 100,
          cost: involuntaryCost,
          note: 'Distribuita per superficie tra unità abitate'
        },
        voluntary: {
          total_percentage: (heatingPct + coolingPct + hotWaterPct + coldWaterPct) * 100,
          remaining_cost: remainingElec - involuntaryCost,
          categories: {
            heating: {
              original_pct: heatingPct * 100,
              adjusted_pct: adjustedHeatingPct * 100,
              total_consumption: totalHeating,
              cost: (remainingElec - involuntaryCost) * adjustedHeatingPct,
              has_consumption: totalHeating > 0
            },
            cooling: {
              original_pct: coolingPct * 100,
              adjusted_pct: adjustedCoolingPct * 100,
              total_consumption: totalCooling,
              cost: (remainingElec - involuntaryCost) * adjustedCoolingPct,
              has_consumption: totalCooling > 0
            },
            hot_water: {
              original_pct: hotWaterPct * 100,
              adjusted_pct: adjustedHotWaterPct * 100,
              total_consumption: totalHotWater,
              cost: (remainingElec - involuntaryCost) * adjustedHotWaterPct,
              has_consumption: totalHotWater > 0
            },
            cold_water: {
              original_pct: coldWaterPct * 100,
              adjusted_pct: adjustedColdWaterPct * 100,
              total_consumption: totalColdWater,
              cost: (remainingElec - involuntaryCost) * adjustedColdWaterPct,
              has_consumption: totalColdWater > 0
            }
          },
          redistribution: {
            active: pctToRedistribute > 0,
            pct_redistributed: pctToRedistribute * 100,
            zero_consumption_categories: zeroConsumptionCategories,
            note: pctToRedistribute > 0
              ? `Il ${(pctToRedistribute * 100).toFixed(0)}% delle categorie senza consumo è stato redistribuito proporzionalmente alle altre categorie volontarie`
              : 'Nessuna redistribuzione necessaria'
          }
        },
        verification: {
          sum_percentages: (elecInvoluntaryPct + adjustedHeatingPct + adjustedCoolingPct + adjustedHotWaterPct + adjustedColdWaterPct) * 100,
          should_be_100: Math.abs((elecInvoluntaryPct + adjustedHeatingPct + adjustedCoolingPct + adjustedHotWaterPct + adjustedColdWaterPct) - 1.0) < 0.001
        }
      };
    }

    res.json(debug);

  } catch (error) {
    console.error('Errore debug calculation:', error);
    res.status(500).json({
      error: 'Errore durante il calcolo debug',
      details: error.message
    });
  }
};
