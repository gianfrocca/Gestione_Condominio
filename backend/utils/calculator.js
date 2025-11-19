/**
 * Algoritmo di ripartizione spese condominiali
 *
 * Gestisce la divisione di:
 * - Metano (40% involontario/60% volontario)
 * - Energia elettrica (40% involontario/60% volontario stagionale)
 * - Acqua fredda
 *
 * Con gestione di:
 * - Costi fissi forfettari
 * - Stagionalità (estate/inverno)
 * - Unità commerciali
 * - Appartamenti non abitati
 */

import { allQuery, getQuery } from '../database.js';

/**
 * Determina se un mese è estate o inverno
 * @param {number} month - Mese (1-12)
 * @param {object} settings - Impostazioni da database
 * @returns {string} 'summer' o 'winter'
 */
function getSeason(month, settings) {
  const summerStart = parseInt(settings.summer_start_month || 6);
  const summerEnd = parseInt(settings.summer_end_month || 9);

  if (month >= summerStart && month <= summerEnd) {
    return 'summer';
  }
  return 'winter';
}

/**
 * Calcola i consumi per unità e tipo in un periodo personalizzato
 * @param {string} dateFrom - Data inizio periodo (YYYY-MM-DD)
 * @param {string} dateTo - Data fine periodo (YYYY-MM-DD)
 * @returns {Promise<object>} Consumi per unità
 */
async function calculateConsumptions(dateFrom, dateTo) {
  console.log(`\n🧮 Calculating consumptions for period: ${dateFrom} to ${dateTo}`);

  // Ottieni tutte le unità con i loro contabilizzatori
  const units = await allQuery(`
    SELECT u.*, m.id as meter_id, m.type as meter_type
    FROM units u
    LEFT JOIN meters m ON u.id = m.unit_id
  `);

  const consumptions = {};

  for (const unit of units) {
    if (!consumptions[unit.id]) {
      consumptions[unit.id] = {
        unit_id: unit.id,
        unit_number: unit.number,
        unit_name: unit.name,
        surface_area: unit.surface_area,
        is_inhabited: unit.is_inhabited,
        is_commercial: unit.is_commercial,
        heating: 0,
        hot_water: 0,
        cold_water: 0
      };
    }

    if (unit.meter_id) {
      // CRITICAL FIX: Lettura INIZIALE deve essere PRIMA del periodo (< dateFrom)
      // Altrimenti se non ci sono letture prima, prende una lettura NEL periodo
      // risultando in startReading = endReading → consumption = 0
      const startReading = await getQuery(
        `SELECT value, reading_date FROM readings
         WHERE meter_id = ? AND reading_date < ?
         ORDER BY reading_date DESC LIMIT 1`,
        [unit.meter_id, dateFrom]
      );

      // Lettura FINALE: la più recente NEL periodo (tra dateFrom e dateTo)
      // Oppure, se non ci sono letture nel periodo, prende l'ultima disponibile <= dateTo
      const endReading = await getQuery(
        `SELECT value, reading_date FROM readings
         WHERE meter_id = ? AND reading_date >= ? AND reading_date <= ?
         ORDER BY reading_date DESC LIMIT 1`,
        [unit.meter_id, dateFrom, dateTo]
      );

      // Fallback: se non ci sono letture NEL periodo, prova l'ultima <= dateTo
      let finalEndReading = endReading;
      if (!finalEndReading) {
        finalEndReading = await getQuery(
          `SELECT value, reading_date FROM readings
           WHERE meter_id = ? AND reading_date <= ?
           ORDER BY reading_date DESC LIMIT 1`,
          [unit.meter_id, dateTo]
        );
      }

      if (finalEndReading && startReading) {
        const consumption = finalEndReading.value - startReading.value;

        console.log(`  📊 Meter ${unit.meter_id} (${unit.meter_type}):`);
        console.log(`     Start: ${startReading.value} (${startReading.reading_date}) [BEFORE period]`);
        console.log(`     End:   ${finalEndReading.value} (${finalEndReading.reading_date}) [IN/AT period]`);
        console.log(`     ➡️ Consumption: ${consumption}`);

        if (consumption < 0) {
          console.error(`  ⚠️ NEGATIVE consumption detected! This should not happen.`);
          console.error(`  Possible counter reset or data error.`);
        }

        switch (unit.meter_type) {
          case 'heating':
            consumptions[unit.id].heating = Math.max(0, consumption); // Prevent negative
            break;
          case 'hot_water':
            consumptions[unit.id].hot_water = Math.max(0, consumption);
            break;
          case 'cold_water':
            consumptions[unit.id].cold_water = Math.max(0, consumption);
            break;
        }
      } else {
        console.log(`  ⚠️ Meter ${unit.meter_id} (${unit.meter_type}): Missing readings`);
        console.log(`     - Start reading (< ${dateFrom}): ${!!startReading}`);
        console.log(`     - End reading (<= ${dateTo}): ${!!finalEndReading}`);
      }
    }
  }

  return Object.values(consumptions);
}

/**
 * Ripartisce i costi del metano
 * @param {number} totalGasCost - Costo totale bolletta gas
 * @param {array} consumptions - Array consumi per unità
 * @param {object} settings - Impostazioni
 * @returns {object} Costi per unità
 */
function splitGasCosts(totalGasCost, consumptions, settings) {
  const involuntaryPct = parseFloat(settings.gas_involuntary_pct) / 100;
  const voluntaryPct = parseFloat(settings.gas_voluntary_pct) / 100;

  const involuntaryCost = totalGasCost * involuntaryPct;
  const voluntaryCost = totalGasCost * voluntaryPct;

  // Solo unità residenziali abitate per calcolo superficie
  const inhabitedUnits = consumptions.filter(u => !u.is_commercial && u.is_inhabited);
  const totalInhabitedSurface = inhabitedUnits.reduce((sum, u) => sum + u.surface_area, 0);

  // Totale consumi ACS (riscaldamento viene gestito separatamente)
  const totalHotWaterConsumption = consumptions
    .filter(u => !u.is_commercial)
    .reduce((sum, u) => sum + u.hot_water, 0);

  // CRITICAL FIX: Se non ci sono consumi ACS, redistribuisci quota volontaria
  let adjustedGasInvoluntaryCost = involuntaryCost;
  let adjustedGasVoluntaryCost = voluntaryCost;

  if (totalHotWaterConsumption === 0 && voluntaryCost > 0) {
    console.log(`⚠️ Zero gas hot water consumption. Redistributing €${voluntaryCost.toFixed(2)} to fixed quota`);
    adjustedGasInvoluntaryCost = involuntaryCost + voluntaryCost;
    adjustedGasVoluntaryCost = 0;
  }

  console.log(`💡 Gas - Involuntary: €${adjustedGasInvoluntaryCost.toFixed(2)}, Voluntary: €${adjustedGasVoluntaryCost.toFixed(2)}`);

  const results = {};

  for (const unit of consumptions) {
    if (unit.is_commercial) {
      results[unit.unit_id] = { heating: 0, hot_water: 0 };
      continue;
    }

    // Quota involontaria: solo se abitato
    let unitInvoluntary = 0;
    if (unit.is_inhabited && totalInhabitedSurface > 0) {
      unitInvoluntary = (adjustedGasInvoluntaryCost * unit.surface_area) / totalInhabitedSurface;
    }

    // Quota volontaria: proporzionale ai consumi ACS (solo se ci sono consumi)
    let unitVoluntary = 0;
    if (totalHotWaterConsumption > 0 && adjustedGasVoluntaryCost > 0) {
      unitVoluntary = (adjustedGasVoluntaryCost * unit.hot_water) / totalHotWaterConsumption;
    }

    // Il metano va principalmente per ACS (acqua calda sanitaria)
    // Una piccola parte può andare per integrazione riscaldamento
    // Per semplicità consideriamo 90% ACS, 10% riscaldamento
    const totalUnit = unitInvoluntary + unitVoluntary;

    results[unit.unit_id] = {
      heating: totalUnit * 0.1,
      hot_water: totalUnit * 0.9
    };
  }

  return results;
}

/**
 * Ripartisce i costi dell'energia elettrica
 * @param {number} totalElecCost - Costo totale bolletta elettricità
 * @param {array} consumptions - Array consumi per unità
 * @param {object} settings - Impostazioni
 * @param {number} month - Mese (1-12)
 * @returns {object} Costi per unità
 */
function splitElectricityCosts(totalElecCost, consumptions, settings, month) {
  const season = getSeason(month, settings);

  const involuntaryPct = parseFloat(settings.elec_involuntary_pct) / 100;
  const voluntaryPct = parseFloat(settings.elec_voluntary_pct) / 100;

  // Percentuali stagionali per la quota volontaria
  let heatingPct, hotWaterPct, coldWaterPct, coolingPct;

  if (season === 'summer') {
    coolingPct = parseFloat(settings.summer_cooling_pct) / 100;
    hotWaterPct = parseFloat(settings.summer_hot_water_pct) / 100;
    coldWaterPct = parseFloat(settings.summer_cold_water_pct) / 100;
    heatingPct = 0;
  } else {
    heatingPct = parseFloat(settings.winter_heating_pct) / 100;
    hotWaterPct = parseFloat(settings.winter_hot_water_pct) / 100;
    coldWaterPct = parseFloat(settings.winter_cold_water_pct) / 100;
    coolingPct = 0;
  }

  // Costi fissi da detrarre dalla quota involontaria
  const staircaseLights = parseFloat(settings.staircase_lights_cost) || 0;
  const commercialWaterFixed = parseFloat(settings.commercial_water_fixed) || 0;

  // 3 appartamenti pagano le luci scale (esclude uno)
  const totalFixedCosts = (staircaseLights * 3) + commercialWaterFixed;

  let involuntaryCost = totalElecCost * involuntaryPct;
  const voluntaryCost = totalElecCost * voluntaryPct;

  // Sottrai i costi fissi dalla quota involontaria
  involuntaryCost -= totalFixedCosts;

  // Peso per unità non abitate (da settings, default 0.3 = 30%)
  const uninhabitedWeight = parseFloat(settings.uninhabited_weight || '0.3');

  // Calcola totali per ripartizioni proporzionali
  const totalSurface = consumptions.reduce((sum, u) => {
    // Se non abitato, partecipa con peso ridotto
    const weight = u.is_inhabited ? 1 : uninhabitedWeight;
    return sum + (u.surface_area * weight);
  }, 0);

  const totalHeating = consumptions
    .filter(u => !u.is_commercial)
    .reduce((sum, u) => sum + u.heating, 0);

  const totalHotWater = consumptions
    .filter(u => !u.is_commercial)
    .reduce((sum, u) => sum + u.hot_water, 0);

  const totalColdWater = consumptions
    .reduce((sum, u) => sum + u.cold_water, 0); // Include commerciale

  // Calcola costi per categoria
  const heatingCost = voluntaryCost * heatingPct;
  const coolingCost = voluntaryCost * coolingPct;
  const hotWaterCost = voluntaryCost * hotWaterPct;
  const coldWaterCost = voluntaryCost * coldWaterPct;

  // CRITICAL FIX: Se una categoria ha ZERO consumi totali, quella quota
  // deve essere ripartita comunque (altrimenti si perde denaro!)
  // Strategia: aggiungerla alla quota involontaria (ripartita per superficie)
  let redistributedCost = 0;

  if (totalHeating === 0 && heatingPct > 0) {
    console.log(`⚠️ Zero heating consumption. Redistributing €${heatingCost.toFixed(2)} to fixed quota`);
    redistributedCost += heatingCost;
  }

  if (totalHotWater === 0 && hotWaterPct > 0) {
    console.log(`⚠️ Zero hot water consumption. Redistributing €${hotWaterCost.toFixed(2)} to fixed quota`);
    redistributedCost += hotWaterCost;
  }

  if (totalColdWater === 0 && coldWaterPct > 0) {
    console.log(`⚠️ Zero cold water consumption. Redistributing €${coldWaterCost.toFixed(2)} to fixed quota`);
    redistributedCost += coldWaterCost;
  }

  // Aggiungi quota redistribuita alla involontaria
  const adjustedInvoluntaryCost = involuntaryCost + redistributedCost;

  console.log(`💡 Involuntary cost: €${involuntaryCost.toFixed(2)} + redistributed: €${redistributedCost.toFixed(2)} = €${adjustedInvoluntaryCost.toFixed(2)}`);

  const results = {};

  for (const unit of consumptions) {
    // Quota involontaria (base superficie) + quota redistribuita
    const surfaceWeight = unit.is_inhabited ? 1 : uninhabitedWeight;
    const weightedSurface = unit.surface_area * surfaceWeight;
    const unitInvoluntary = totalSurface > 0
      ? (adjustedInvoluntaryCost * weightedSurface) / totalSurface
      : 0;

    // Quota volontaria riscaldamento (solo residenziali)
    let unitHeating = 0;
    if (!unit.is_commercial && totalHeating > 0) {
      unitHeating = (heatingCost * unit.heating) / totalHeating;
    }

    // Quota volontaria raffrescamento (solo residenziali)
    let unitCooling = 0;
    if (!unit.is_commercial && totalHeating > 0) { // Uso stesso contabilizzatore
      unitCooling = (coolingCost * unit.heating) / totalHeating;
    }

    // Quota volontaria ACS (solo residenziali)
    let unitHotWater = 0;
    if (!unit.is_commercial && totalHotWater > 0) {
      unitHotWater = (hotWaterCost * unit.hot_water) / totalHotWater;
    }

    // Quota volontaria ACF (tutti, anche commerciale)
    let unitColdWater = 0;
    if (totalColdWater > 0) {
      unitColdWater = (coldWaterCost * unit.cold_water) / totalColdWater;
    }

    // Gestione quota fissa commerciale
    let commercialFixed = 0;
    if (unit.is_commercial) {
      commercialFixed = -commercialWaterFixed; // Viene sottratto
    }

    results[unit.unit_id] = {
      fixed: unitInvoluntary + commercialFixed,
      heating: unitHeating,
      cooling: unitCooling,
      hot_water: unitHotWater,
      cold_water: unitColdWater
    };
  }

  return results;
}

/**
 * Calcola la ripartizione completa per un periodo personalizzato
 * @param {string} dateFrom - Data inizio periodo (YYYY-MM-DD)
 * @param {string} dateTo - Data fine periodo (YYYY-MM-DD)
 * @param {string} type - Tipo calcolo: 'gas', 'electricity', 'both' (default: 'both')
 * @returns {Promise<object>} Ripartizione completa
 */
export async function calculateMonthlySplit(dateFrom, dateTo, type = 'both') {
  try {
    console.log(`\n💰 ========== CALCULATION STARTED ==========`);
    console.log(`📅 Period: ${dateFrom} to ${dateTo}`);
    console.log(`📊 Type: ${type}`);

    // Carica impostazioni
    const settingsRows = await allQuery('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    // Determina quale mese usare per stagionalità (usa il mese centrale del periodo)
    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
    const monthNum = midDate.getMonth() + 1; // 1-12

    console.log(`🌡️ Season calculation based on month: ${monthNum}`);

    // Somma bollette nel periodo (per tipo)
    let totalGasCost = 0;
    let totalElecCost = 0;

    if (type === 'gas' || type === 'both') {
      const gasBills = await allQuery(
        `SELECT SUM(amount) as total FROM bills
         WHERE type = 'gas' AND bill_date >= ? AND bill_date <= ?`,
        [dateFrom, dateTo]
      );
      totalGasCost = gasBills[0]?.total || 0;
      console.log(`🔥 Total gas bills in period: €${totalGasCost.toFixed(2)}`);

      if (totalGasCost === 0 && type === 'gas') {
        throw new Error('Nessuna bolletta gas trovata nel periodo specificato');
      }
    }

    if (type === 'electricity' || type === 'both') {
      const elecBills = await allQuery(
        `SELECT SUM(amount) as total FROM bills
         WHERE type = 'electricity' AND bill_date >= ? AND bill_date <= ?`,
        [dateFrom, dateTo]
      );
      totalElecCost = elecBills[0]?.total || 0;
      console.log(`⚡ Total electricity bills in period: €${totalElecCost.toFixed(2)}`);

      if (totalElecCost === 0 && type === 'electricity') {
        throw new Error('Nessuna bolletta energia elettrica trovata nel periodo specificato');
      }
    }

    if (type === 'both' && totalGasCost === 0 && totalElecCost === 0) {
      throw new Error('Nessuna bolletta trovata nel periodo specificato');
    }

    // Calcola consumi
    const consumptions = await calculateConsumptions(dateFrom, dateTo);

    if (consumptions.length === 0) {
      throw new Error('Nessun dato di consumo trovato per il mese specificato');
    }

    // Ripartisci costi
    let gasCosts = {};
    let elecCosts = {};

    if (type === 'gas' || type === 'both') {
      gasCosts = splitGasCosts(totalGasCost, consumptions, settings);
    }

    if (type === 'electricity' || type === 'both') {
      elecCosts = splitElectricityCosts(totalElecCost, consumptions, settings, monthNum);
    }

    // Combina risultati
    const results = [];
    for (const unit of consumptions) {
      const gas = gasCosts[unit.unit_id] || { heating: 0, hot_water: 0 };
      const elec = elecCosts[unit.unit_id] || { fixed: 0, heating: 0, cooling: 0, hot_water: 0, cold_water: 0 };

      const total = gas.heating + gas.hot_water +
                    elec.fixed + elec.heating + elec.cooling +
                    elec.hot_water + elec.cold_water;

      results.push({
        unit_id: unit.unit_id,
        unit_number: unit.unit_number,
        unit_name: unit.unit_name,
        surface_area: unit.surface_area,
        is_inhabited: unit.is_inhabited,
        is_commercial: unit.is_commercial,
        consumptions: {
          heating: unit.heating,
          hot_water: unit.hot_water,
          cold_water: unit.cold_water
        },
        costs: {
          gas_heating: gas.heating,
          gas_hot_water: gas.hot_water,
          elec_fixed: elec.fixed,
          elec_heating: elec.heating,
          elec_cooling: elec.cooling,
          elec_hot_water: elec.hot_water,
          elec_cold_water: elec.cold_water,
          total: total
        }
      });
    }

    // CRITICAL VERIFICATION: Somma unità DEVE essere uguale a somma bollette
    const sumUnitsTotal = results.reduce((sum, unit) => sum + unit.costs.total, 0);
    const expectedTotal = totalGasCost + totalElecCost;
    const difference = Math.abs(sumUnitsTotal - expectedTotal);
    const tolerance = 0.02; // Tolleranza 2 centesimi per arrotondamenti

    console.log(`\n🔍 ========== VERIFICATION ==========`);
    console.log(`💰 Total bills: €${expectedTotal.toFixed(2)}`);
    console.log(`📊 Sum of units: €${sumUnitsTotal.toFixed(2)}`);
    console.log(`🔢 Difference: €${difference.toFixed(4)}`);

    if (difference > tolerance) {
      console.error(`\n❌❌❌ CRITICAL ERROR: MONEY LOST/GAINED!`);
      console.error(`Expected: €${expectedTotal.toFixed(2)}`);
      console.error(`Calculated: €${sumUnitsTotal.toFixed(2)}`);
      console.error(`Difference: €${difference.toFixed(2)}`);
      throw new Error(`Verifica fallita: la somma delle unità (€${sumUnitsTotal.toFixed(2)}) non corrisponde al totale bollette (€${expectedTotal.toFixed(2)}). Differenza: €${difference.toFixed(2)}`);
    }

    console.log(`✅ Verification passed! Difference within tolerance.`);
    console.log(`✅ ========== CALCULATION COMPLETE ==========\n`);

    return {
      period: {
        from: dateFrom,
        to: dateTo
      },
      type: type,
      total_gas_cost: totalGasCost,
      total_elec_cost: totalElecCost,
      total_cost: totalGasCost + totalElecCost,
      units: results,
      verification: {
        expected_total: expectedTotal,
        calculated_total: sumUnitsTotal,
        difference: difference,
        passed: difference <= tolerance
      }
    };
  } catch (error) {
    console.error('Errore calcolo ripartizione:', error);
    throw error;
  }
}

export default {
  calculateMonthlySplit,
  getSeason
};
