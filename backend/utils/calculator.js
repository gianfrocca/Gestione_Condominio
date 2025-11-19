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
  console.log(`\n🔥 ========== GAS COST SPLIT ==========`);
  console.log(`💰 Total gas cost: €${totalGasCost.toFixed(2)}`);

  const involuntaryPct = parseFloat(settings.gas_involuntary_pct) / 100;
  const voluntaryPct = parseFloat(settings.gas_voluntary_pct) / 100;

  console.log(`📊 Split: ${(involuntaryPct * 100).toFixed(0)}% involuntary / ${(voluntaryPct * 100).toFixed(0)}% voluntary`);

  // CRITICAL: Unità "Abitati No" pagano un forfettario fisso e NON partecipano alla ripartizione
  const uninhabitedForfait = consumptions
    .filter(u => !u.is_inhabited)
    .reduce((sum, u) => sum + (u.monthly_gas_fixed || 0), 0);

  console.log(`\n💰 Uninhabited units forfait: €${uninhabitedForfait.toFixed(2)}`);

  const costToDistribute = totalGasCost - uninhabitedForfait;

  if (costToDistribute < 0) {
    throw new Error(`Errore: i forfettari delle unità non abitate (€${uninhabitedForfait.toFixed(2)}) superano il totale bolletta (€${totalGasCost.toFixed(2)})`);
  }

  console.log(`💵 Cost to distribute among inhabited units: €${totalGasCost.toFixed(2)} - €${uninhabitedForfait.toFixed(2)} = €${costToDistribute.toFixed(2)}`);

  const involuntaryCost = costToDistribute * involuntaryPct;
  const voluntaryCost = costToDistribute * voluntaryPct;

  console.log(`💵 Split: involuntary=€${involuntaryCost.toFixed(2)}, voluntary=€${voluntaryCost.toFixed(2)}`);

  // Solo unità residenziali abitate per calcolo superficie
  const inhabitedUnits = consumptions.filter(u => !u.is_commercial && u.is_inhabited);
  const uninhabitedUnits = consumptions.filter(u => !u.is_inhabited);
  const totalInhabitedSurface = inhabitedUnits.reduce((sum, u) => sum + u.surface_area, 0);

  console.log(`\n📏 Total surface (inhabited non-commercial): ${totalInhabitedSurface.toFixed(2)} m²`);

  // Totale consumi ACS SOLO da unità abitate
  const totalHotWaterConsumption = inhabitedUnits.reduce((sum, u) => sum + u.hot_water, 0);

  console.log(`🔥 Total hot water consumption (inhabited): ${totalHotWaterConsumption.toFixed(2)} m³`);

  // CRITICAL FIX: Se non ci sono consumi ACS, redistribuisci quota volontaria
  let adjustedGasInvoluntaryCost = involuntaryCost;
  let adjustedGasVoluntaryCost = voluntaryCost;

  if (totalHotWaterConsumption === 0 && voluntaryCost > 0) {
    console.log(`⚠️ Zero gas hot water consumption. Redistributing €${voluntaryCost.toFixed(2)} to fixed quota`);
    adjustedGasInvoluntaryCost = involuntaryCost + voluntaryCost;
    adjustedGasVoluntaryCost = 0;
  }

  console.log(`💡 Adjusted Gas - Involuntary: €${adjustedGasInvoluntaryCost.toFixed(2)}, Voluntary: €${adjustedGasVoluntaryCost.toFixed(2)}`);

  const results = {};

  for (const unit of consumptions) {
    // Commerciali: non partecipano al gas
    if (unit.is_commercial) {
      results[unit.unit_id] = { heating: 0, hot_water: 0 };
      continue;
    }

    // UNITÀ NON ABITATE: pagano SOLO il forfettario
    if (!unit.is_inhabited) {
      const forfait = unit.monthly_gas_fixed || 0;
      console.log(`   ⚠️ Unit ${unit.unit_number}: Uninhabited, pays ONLY €${forfait.toFixed(2)} forfait`);

      results[unit.unit_id] = {
        heating: forfait * 0.1,  // Split 10% heating, 90% hot water for display purposes
        hot_water: forfait * 0.9
      };
      continue;
    }

    // UNITÀ ABITATE: partecipano alla ripartizione

    // Quota involontaria: proporzionale alla superficie
    let unitInvoluntary = 0;
    if (totalInhabitedSurface > 0) {
      unitInvoluntary = (adjustedGasInvoluntaryCost * unit.surface_area) / totalInhabitedSurface;
    }

    // Quota volontaria: proporzionale ai consumi ACS
    let unitVoluntary = 0;
    if (totalHotWaterConsumption > 0 && adjustedGasVoluntaryCost > 0) {
      unitVoluntary = (adjustedGasVoluntaryCost * unit.hot_water) / totalHotWaterConsumption;
    }

    // Il metano va principalmente per ACS (acqua calda sanitaria)
    // Una piccola parte può andare per integrazione riscaldamento
    // Per semplicità consideriamo 90% ACS, 10% riscaldamento
    const totalUnit = unitInvoluntary + unitVoluntary;

    console.log(`   📍 Unit ${unit.unit_number}: Involuntary=€${unitInvoluntary.toFixed(2)}, Voluntary=€${unitVoluntary.toFixed(2)}, Total=€${totalUnit.toFixed(2)}`);

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

  console.log(`\n⚡ ========== ELECTRICITY COST SPLIT (${season.toUpperCase()}) ==========`);
  console.log(`💰 Total electricity cost: €${totalElecCost.toFixed(2)}`);

  const involuntaryPct = parseFloat(settings.elec_involuntary_pct) / 100;
  const voluntaryPct = parseFloat(settings.elec_voluntary_pct) / 100;

  console.log(`📊 Split: ${(involuntaryPct * 100).toFixed(0)}% involuntary / ${(voluntaryPct * 100).toFixed(0)}% voluntary`);

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

  console.log(`🌡️ Seasonal percentages: heating=${(heatingPct * 100).toFixed(0)}%, cooling=${(coolingPct * 100).toFixed(0)}%, hotWater=${(hotWaterPct * 100).toFixed(0)}%, coldWater=${(coldWaterPct * 100).toFixed(0)}%`);

  // VERIFICA CRITICA: La somma delle percentuali stagionali DEVE essere uguale alla quota volontaria
  const seasonalSum = heatingPct + coolingPct + hotWaterPct + coldWaterPct;
  const expectedSum = voluntaryPct;

  console.log(`\n🔍 Verification: seasonal percentages sum = ${(seasonalSum * 100).toFixed(0)}%, expected = ${(expectedSum * 100).toFixed(0)}%`);

  if (Math.abs(seasonalSum - expectedSum) > 0.01) {
    const error = `ERRORE CONFIGURAZIONE: Le percentuali stagionali (${(seasonalSum * 100).toFixed(0)}%) non sommano alla quota volontaria (${(expectedSum * 100).toFixed(0)}%). Verifica le impostazioni.`;
    console.error(`\n❌ ${error}`);
    throw new Error(error);
  }
  console.log(`✅ Seasonal percentages verification passed`);

  // CRITICAL: Unità "Abitati No" pagano un forfettario fisso e NON partecipano alla ripartizione
  // 1. Sommare tutti i forfettari delle unità non abitate
  // 2. Sottrarre dal totale bolletta
  // 3. Distribuire il resto SOLO tra le unità abitate

  const uninhabitedForfait = consumptions
    .filter(u => !u.is_inhabited)
    .reduce((sum, u) => sum + (u.monthly_elec_fixed || 0), 0);

  console.log(`\n💰 Uninhabited units forfait: €${uninhabitedForfait.toFixed(2)}`);

  const costToDistribute = totalElecCost - uninhabitedForfait;

  if (costToDistribute < 0) {
    throw new Error(`Errore: i forfettari delle unità non abitate (€${uninhabitedForfait.toFixed(2)}) superano il totale bolletta (€${totalElecCost.toFixed(2)})`);
  }

  console.log(`💵 Cost to distribute among inhabited units: €${totalElecCost.toFixed(2)} - €${uninhabitedForfait.toFixed(2)} = €${costToDistribute.toFixed(2)}`);

  const involuntaryCost = costToDistribute * involuntaryPct;
  const voluntaryCost = costToDistribute * voluntaryPct;

  console.log(`💵 Split: involuntary=€${involuntaryCost.toFixed(2)}, voluntary=€${voluntaryCost.toFixed(2)}`);

  // Calcola totali SOLO per le unità ABITATE (quelle che partecipano alla ripartizione)
  const inhabitedUnits = consumptions.filter(u => u.is_inhabited);
  const uninhabitedUnits = consumptions.filter(u => !u.is_inhabited);

  const totalSurface = inhabitedUnits.reduce((sum, u) => sum + u.surface_area, 0);

  console.log(`\n📏 Total surface (inhabited only): ${totalSurface.toFixed(2)} m²`);
  console.log(`📊 Inhabited units breakdown:`);
  inhabitedUnits.forEach(u => {
    console.log(`   - ${u.unit_number} (${u.unit_name}): ${u.surface_area}m² [commercial=${u.is_commercial}]`);
  });

  if (uninhabitedUnits.length > 0) {
    console.log(`📊 Uninhabited units (pay only forfait, do NOT participate in distribution):`);
    uninhabitedUnits.forEach(u => {
      console.log(`   - ${u.unit_number} (${u.unit_name}): €${(u.monthly_elec_fixed || 0).toFixed(2)}/month forfait`);
    });
  }

  // Consumi totali: SOLO unità abitate e non commerciali per riscaldamento/ACS
  const totalHeating = inhabitedUnits
    .filter(u => !u.is_commercial)
    .reduce((sum, u) => sum + u.heating, 0);

  const totalHotWater = inhabitedUnits
    .filter(u => !u.is_commercial)
    .reduce((sum, u) => sum + u.hot_water, 0);

  // Acqua fredda: tutte le unità abitate, anche commerciali
  const totalColdWater = inhabitedUnits
    .reduce((sum, u) => sum + u.cold_water, 0);

  console.log(`\n🔥 Total consumptions:`);
  console.log(`   - Heating: ${totalHeating.toFixed(2)} kWh`);
  console.log(`   - Hot Water: ${totalHotWater.toFixed(2)} m³`);
  console.log(`   - Cold Water: ${totalColdWater.toFixed(2)} m³`);

  // Calcola costi per categoria
  const heatingCost = voluntaryCost * heatingPct;
  const coolingCost = voluntaryCost * coolingPct;
  const hotWaterCost = voluntaryCost * hotWaterPct;
  const coldWaterCost = voluntaryCost * coldWaterPct;

  console.log(`\n💰 Cost allocation by category (from €${voluntaryCost.toFixed(2)} voluntary):`);
  console.log(`   - Heating: €${heatingCost.toFixed(2)} (${(heatingPct * 100).toFixed(0)}%)`);
  console.log(`   - Cooling: €${coolingCost.toFixed(2)} (${(coolingPct * 100).toFixed(0)}%)`);
  console.log(`   - Hot Water: €${hotWaterCost.toFixed(2)} (${(hotWaterPct * 100).toFixed(0)}%)`);
  console.log(`   - Cold Water: €${coldWaterCost.toFixed(2)} (${(coldWaterPct * 100).toFixed(0)}%)`);
  console.log(`   - SUM: €${(heatingCost + coolingCost + hotWaterCost + coldWaterCost).toFixed(2)}`);

  // CRITICAL FIX: Se una categoria ha ZERO consumi totali, quella quota
  // deve essere ripartita comunque (altrimenti si perde denaro!)
  // Strategia: aggiungerla alla quota involontaria (ripartita per superficie)
  let redistributedCost = 0;

  console.log(`\n🔄 Checking for categories with zero consumption...`);

  if (totalHeating === 0 && heatingPct > 0) {
    console.log(`   ⚠️ Zero heating consumption. Redistributing €${heatingCost.toFixed(2)} to fixed quota`);
    redistributedCost += heatingCost;
  }

  if (totalHotWater === 0 && hotWaterPct > 0) {
    console.log(`   ⚠️ Zero hot water consumption. Redistributing €${hotWaterCost.toFixed(2)} to fixed quota`);
    redistributedCost += hotWaterCost;
  }

  if (totalColdWater === 0 && coldWaterPct > 0) {
    console.log(`   ⚠️ Zero cold water consumption. Redistributing €${coldWaterCost.toFixed(2)} to fixed quota`);
    redistributedCost += coldWaterCost;
  }

  // Aggiungi quota redistribuita alla involontaria
  const adjustedInvoluntaryCost = involuntaryCost + redistributedCost;

  console.log(`\n💡 Final involuntary cost calculation:`);
  console.log(`   Base involuntary: €${involuntaryCost.toFixed(2)}`);
  console.log(`   + Redistributed (from zero-consumption categories): €${redistributedCost.toFixed(2)}`);
  console.log(`   = Adjusted involuntary: €${adjustedInvoluntaryCost.toFixed(2)}`);

  const results = {};

  console.log(`\n💵 Distributing costs to units...`);

  let totalDistributedInvoluntary = 0;
  let totalDistributedHeating = 0;
  let totalDistributedCooling = 0;
  let totalDistributedHotWater = 0;
  let totalDistributedColdWater = 0;

  for (const unit of consumptions) {
    console.log(`\n   📍 Unit ${unit.unit_number} (${unit.unit_name}):`);
    console.log(`      Surface: ${unit.surface_area}m², inhabited: ${unit.is_inhabited}, commercial: ${unit.is_commercial}`);
    console.log(`      Consumptions: heating=${unit.heating.toFixed(2)}, hotWater=${unit.hot_water.toFixed(2)}, coldWater=${unit.cold_water.toFixed(2)}`);

    // UNITÀ NON ABITATE: pagano SOLO il forfettario, NON partecipano alla ripartizione
    if (!unit.is_inhabited) {
      const forfait = unit.monthly_elec_fixed || 0;
      console.log(`      ⚠️ Uninhabited unit: pays ONLY €${forfait.toFixed(2)} forfait (does NOT participate in distribution)`);

      results[unit.unit_id] = {
        fixed: forfait,
        heating: 0,
        cooling: 0,
        hot_water: 0,
        cold_water: 0
      };
      continue; // Skip to next unit
    }

    // UNITÀ ABITATE: partecipano alla ripartizione normale

    // Quota involontaria (base superficie) + quota redistribuita
    const unitInvoluntary = totalSurface > 0
      ? (adjustedInvoluntaryCost * unit.surface_area) / totalSurface
      : 0;

    console.log(`      Involuntary: €${adjustedInvoluntaryCost.toFixed(2)} × ${unit.surface_area.toFixed(2)}/${totalSurface.toFixed(2)} = €${unitInvoluntary.toFixed(2)}`);
    totalDistributedInvoluntary += unitInvoluntary;

    // Quota volontaria riscaldamento (solo residenziali)
    let unitHeating = 0;
    if (!unit.is_commercial && totalHeating > 0) {
      unitHeating = (heatingCost * unit.heating) / totalHeating;
      console.log(`      Heating: €${heatingCost.toFixed(2)} × ${unit.heating.toFixed(2)}/${totalHeating.toFixed(2)} = €${unitHeating.toFixed(2)}`);
      totalDistributedHeating += unitHeating;
    }

    // Quota volontaria raffrescamento (solo residenziali)
    let unitCooling = 0;
    if (!unit.is_commercial && totalHeating > 0) { // Uso stesso contabilizzatore
      unitCooling = (coolingCost * unit.heating) / totalHeating;
      if (coolingCost > 0) {
        console.log(`      Cooling: €${coolingCost.toFixed(2)} × ${unit.heating.toFixed(2)}/${totalHeating.toFixed(2)} = €${unitCooling.toFixed(2)}`);
      }
      totalDistributedCooling += unitCooling;
    }

    // Quota volontaria ACS (solo residenziali)
    let unitHotWater = 0;
    if (!unit.is_commercial && totalHotWater > 0) {
      unitHotWater = (hotWaterCost * unit.hot_water) / totalHotWater;
      console.log(`      Hot water: €${hotWaterCost.toFixed(2)} × ${unit.hot_water.toFixed(2)}/${totalHotWater.toFixed(2)} = €${unitHotWater.toFixed(2)}`);
      totalDistributedHotWater += unitHotWater;
    }

    // Quota volontaria ACF (tutti, anche commerciale)
    let unitColdWater = 0;
    if (totalColdWater > 0) {
      unitColdWater = (coldWaterCost * unit.cold_water) / totalColdWater;
      if (unit.cold_water > 0) {
        console.log(`      Cold water: €${coldWaterCost.toFixed(2)} × ${unit.cold_water.toFixed(2)}/${totalColdWater.toFixed(2)} = €${unitColdWater.toFixed(2)}`);
      }
      totalDistributedColdWater += unitColdWater;
    }

    const unitTotal = unitInvoluntary + unitHeating + unitCooling + unitHotWater + unitColdWater;
    console.log(`      ➡️ TOTAL FOR UNIT: €${unitTotal.toFixed(2)}`);

    results[unit.unit_id] = {
      fixed: unitInvoluntary,
      heating: unitHeating,
      cooling: unitCooling,
      hot_water: unitHotWater,
      cold_water: unitColdWater
    };
  }

  console.log(`\n📊 ========== DISTRIBUTION SUMMARY ==========`);
  console.log(`Total distributed involuntary: €${totalDistributedInvoluntary.toFixed(2)} (should be €${adjustedInvoluntaryCost.toFixed(2)})`);
  console.log(`Total distributed heating: €${totalDistributedHeating.toFixed(2)} (should be €${heatingCost.toFixed(2)} if consumed, €0 if redistributed)`);
  console.log(`Total distributed cooling: €${totalDistributedCooling.toFixed(2)} (should be €${coolingCost.toFixed(2)} if consumed, €0 if redistributed)`);
  console.log(`Total distributed hot water: €${totalDistributedHotWater.toFixed(2)} (should be €${hotWaterCost.toFixed(2)} if consumed, €0 if redistributed)`);
  console.log(`Total distributed cold water: €${totalDistributedColdWater.toFixed(2)} (should be €${coldWaterCost.toFixed(2)} if consumed, €0 if redistributed)`);

  const distributedToInhabited = totalDistributedInvoluntary + totalDistributedHeating + totalDistributedCooling +
                                  totalDistributedHotWater + totalDistributedColdWater;

  console.log(`\n💰 DISTRIBUTED TO INHABITED UNITS: €${distributedToInhabited.toFixed(2)} (should be €${costToDistribute.toFixed(2)})`);
  console.log(`💰 FORFAIT FROM UNINHABITED UNITS: €${uninhabitedForfait.toFixed(2)}`);

  const grandTotal = distributedToInhabited + uninhabitedForfait;

  console.log(`💰 GRAND TOTAL: €${grandTotal.toFixed(2)}`);
  console.log(`💰 EXPECTED (from bill): €${totalElecCost.toFixed(2)}`);
  console.log(`💰 DIFFERENCE: €${(totalElecCost - grandTotal).toFixed(2)}`);

  if (Math.abs(totalElecCost - grandTotal) > 0.02) {
    console.log(`\n❌ ERROR: Money lost/gained in electricity distribution!`);
    console.log(`   Distributed to inhabited: €${distributedToInhabited.toFixed(2)} (expected: €${costToDistribute.toFixed(2)})`);
    console.log(`   Uninhabited forfait: €${uninhabitedForfait.toFixed(2)}`);
    console.log(`   Total: €${grandTotal.toFixed(2)} vs expected: €${totalElecCost.toFixed(2)}`);
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
