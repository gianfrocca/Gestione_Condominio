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
    SELECT u.*, m.id as meter_id, m.type as meter_type, m.meter_code
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
        has_staircase_lights: unit.has_staircase_lights || false,
        monthly_water_fixed: unit.monthly_water_fixed || 0,
        monthly_elec_fixed_winter: unit.monthly_elec_fixed_winter || 0,
        monthly_elec_fixed_summer: unit.monthly_elec_fixed_summer || 0,
        monthly_gas_fixed_winter: unit.monthly_gas_fixed_winter || 0,
        monthly_gas_fixed_summer: unit.monthly_gas_fixed_summer || 0,
        heating: 0,
        hot_water: 0,
        cold_water: 0,
        readings: [] // Array per le letture dei contabilizzatori
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

        // Aggiungi letture all'array readings
        consumptions[unit.id].readings.push({
          meter_id: unit.meter_id,
          meter_type: unit.meter_type,
          meter_code: unit.meter_code || '-',
          start_value: startReading.value,
          start_date: startReading.reading_date,
          end_value: finalEndReading.value,
          end_date: finalEndReading.reading_date,
          consumption: Math.max(0, consumption)
        });

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
 * Ripartisce i costi del metano (con logica stagionale)
 * @param {number} totalGasCost - Costo totale bolletta gas
 * @param {array} consumptions - Array consumi per unità
 * @param {object} settings - Impostazioni
 * @param {string} season - Stagione ('summer' o 'winter')
 * @returns {object} Costi per unità
 */
function splitGasCosts(totalGasCost, consumptions, settings, season) {
  console.log(`\n🔥 ========== GAS COST SPLIT (${season.toUpperCase()}) ==========`);
  console.log(`💰 Total gas cost: €${totalGasCost.toFixed(2)}`);

  // STEP 1: Sottrai costi parti comuni
  const commonAreasCost = parseFloat(settings.common_areas_gas_monthly || 0);
  console.log(`🏢 Common areas cost: €${commonAreasCost.toFixed(2)}`);

  let totalAfterCommonAreas = totalGasCost - commonAreasCost;

  if (totalAfterCommonAreas < 0) {
    throw new Error(`Errore: i costi parti comuni gas (€${commonAreasCost.toFixed(2)}) superano il totale bolletta (€${totalGasCost.toFixed(2)})`);
  }

  console.log(`💵 After common areas: €${totalGasCost.toFixed(2)} - €${commonAreasCost.toFixed(2)} = €${totalAfterCommonAreas.toFixed(2)}`);

  // STEP 2: Calcola forfait stagionali per unità non abitate
  // Ora i forfait sono SOLO nelle unità (non più default in settings)
  const uninhabitedForfait = consumptions
    .filter(u => !u.is_inhabited)
    .reduce((sum, u) => {
      const unitForfait = season === 'summer'
        ? (u.monthly_gas_fixed_summer || 0)
        : (u.monthly_gas_fixed_winter || 0);
      return sum + unitForfait;
    }, 0);

  console.log(`💰 Total uninhabited units forfait (${season}): €${uninhabitedForfait.toFixed(2)}`);

  const costToDistribute = totalAfterCommonAreas - uninhabitedForfait;

  if (costToDistribute < 0) {
    throw new Error(`Errore: i forfettari delle unità non abitate (€${uninhabitedForfait.toFixed(2)}) superano il costo disponibile (€${totalAfterCommonAreas.toFixed(2)})`);
  }

  console.log(`💵 Cost to distribute among inhabited units: €${totalAfterCommonAreas.toFixed(2)} - €${uninhabitedForfait.toFixed(2)} = €${costToDistribute.toFixed(2)}`);

  // STEP 3: Percentuali stagionali
  const involuntaryPct = parseFloat(settings.gas_involuntary_pct) / 100;

  let heatingPct, hotWaterPct;

  if (season === 'summer') {
    heatingPct = 0;
    hotWaterPct = parseFloat(settings.gas_summer_hot_water_pct) / 100;
  } else {
    heatingPct = parseFloat(settings.gas_winter_heating_pct) / 100;
    hotWaterPct = parseFloat(settings.gas_winter_hot_water_pct) / 100;
  }

  console.log(`📊 Seasonal percentages:`);
  console.log(`   - Involuntary: ${(involuntaryPct * 100).toFixed(0)}%`);
  console.log(`   - Heating: ${(heatingPct * 100).toFixed(0)}%`);
  console.log(`   - Hot Water: ${(hotWaterPct * 100).toFixed(0)}%`);

  // Verifica che le percentuali sommino a 100%
  const totalPct = involuntaryPct + heatingPct + hotWaterPct;
  if (Math.abs(totalPct - 1.0) > 0.01) {
    const error = `ERRORE CONFIGURAZIONE GAS: Le percentuali (involontaria ${(involuntaryPct * 100).toFixed(0)}% + riscaldamento ${(heatingPct * 100).toFixed(0)}% + ACS ${(hotWaterPct * 100).toFixed(0)}% = ${(totalPct * 100).toFixed(0)}%) non sommano al 100%.`;
    console.error(`\n❌ ${error}`);
    throw new Error(error);
  }
  console.log(`✅ Percentages verification passed (sum = 100%)`);

  // STEP 4: Allocazione per categoria (sul TOTALE)
  const involuntaryCost = costToDistribute * involuntaryPct;
  const heatingCost = costToDistribute * heatingPct;
  const hotWaterCost = costToDistribute * hotWaterPct;

  console.log(`\n💰 Cost allocation by category (percentages applied to total €${costToDistribute.toFixed(2)}):`);
  console.log(`   - Involuntary (${(involuntaryPct * 100).toFixed(0)}%): €${involuntaryCost.toFixed(2)}`);
  console.log(`   - Heating (${(heatingPct * 100).toFixed(0)}%): €${heatingCost.toFixed(2)}`);
  console.log(`   - Hot Water (${(hotWaterPct * 100).toFixed(0)}%): €${hotWaterCost.toFixed(2)}`);

  // Solo unità residenziali abitate
  const inhabitedUnits = consumptions.filter(u => !u.is_commercial && u.is_inhabited);
  const totalInhabitedSurface = inhabitedUnits.reduce((sum, u) => sum + u.surface_area, 0);

  console.log(`\n📏 Total surface (inhabited non-commercial): ${totalInhabitedSurface.toFixed(2)} m²`);

  // Totali consumi SOLO unità abitate
  const totalHeating = inhabitedUnits.reduce((sum, u) => sum + u.heating, 0);
  const totalHotWater = inhabitedUnits.reduce((sum, u) => sum + u.hot_water, 0);

  console.log(`🔥 Total consumptions (inhabited):`);
  console.log(`   - Heating: ${totalHeating.toFixed(2)} kWh`);
  console.log(`   - Hot Water: ${totalHotWater.toFixed(2)} m³`);

  // STEP 5: Gestione categorie con ZERO consumi
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

  const adjustedInvoluntaryCost = involuntaryCost + redistributedCost;

  console.log(`\n💡 Final involuntary cost calculation:`);
  console.log(`   Base involuntary: €${involuntaryCost.toFixed(2)}`);
  console.log(`   + Redistributed (from zero-consumption categories): €${redistributedCost.toFixed(2)}`);
  console.log(`   = Adjusted involuntary: €${adjustedInvoluntaryCost.toFixed(2)}`);

  // STEP 6: Distribuzione alle unità
  const results = {};

  console.log(`\n💵 Distributing costs to units...`);

  for (const unit of consumptions) {
    console.log(`\n   📍 Unit ${unit.unit_number} (${unit.unit_name}):`);

    // Commerciali: non partecipano al gas
    if (unit.is_commercial) {
      results[unit.unit_id] = { heating: 0, hot_water: 0 };
      console.log(`      ⚠️ Commercial unit: does NOT participate in gas distribution`);
      continue;
    }

    // UNITÀ NON ABITATE: pagano SOLO il forfettario stagionale
    if (!unit.is_inhabited) {
      const forfait = season === 'summer'
        ? (unit.monthly_gas_fixed_summer || 0)
        : (unit.monthly_gas_fixed_winter || 0);
      console.log(`      ⚠️ Uninhabited unit: pays ONLY €${forfait.toFixed(2)} forfait (${season})`);

      results[unit.unit_id] = {
        heating: forfait * 0.5,  // Split 50/50 for display
        hot_water: forfait * 0.5
      };
      continue;
    }

    // UNITÀ ABITATE: partecipano alla ripartizione

    // Quota involontaria (proporzionale alla superficie)
    const unitInvoluntary = totalInhabitedSurface > 0
      ? (adjustedInvoluntaryCost * unit.surface_area) / totalInhabitedSurface
      : 0;

    console.log(`      Involuntary: €${adjustedInvoluntaryCost.toFixed(2)} × ${unit.surface_area.toFixed(2)}/${totalInhabitedSurface.toFixed(2)} = €${unitInvoluntary.toFixed(2)}`);

    // Quota riscaldamento (proporzionale ai consumi riscaldamento)
    let unitHeating = 0;
    if (totalHeating > 0) {
      unitHeating = (heatingCost * unit.heating) / totalHeating;
      console.log(`      Heating: €${heatingCost.toFixed(2)} × ${unit.heating.toFixed(2)}/${totalHeating.toFixed(2)} = €${unitHeating.toFixed(2)}`);
    }

    // Quota ACS (proporzionale ai consumi ACS)
    let unitHotWater = 0;
    if (totalHotWater > 0) {
      unitHotWater = (hotWaterCost * unit.hot_water) / totalHotWater;
      console.log(`      Hot Water: €${hotWaterCost.toFixed(2)} × ${unit.hot_water.toFixed(2)}/${totalHotWater.toFixed(2)} = €${unitHotWater.toFixed(2)}`);
    }

    const totalUnit = unitInvoluntary + unitHeating + unitHotWater;
    console.log(`      ➡️ TOTAL FOR UNIT: €${totalUnit.toFixed(2)}`);

    results[unit.unit_id] = {
      heating: unitInvoluntary * 0.1 + unitHeating, // Involuntaria va per il 10% al riscaldamento, il resto all'heating quota
      hot_water: unitInvoluntary * 0.9 + unitHotWater // Involontaria va per il 90% all'ACS, il resto all'ACS quota
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

  // STEP 1: Sottrai costi parti comuni
  const commonAreasCost = parseFloat(settings.common_areas_elec_monthly || 0);
  console.log(`🏢 Common areas cost: €${commonAreasCost.toFixed(2)}`);

  let totalAfterCommonAreas = totalElecCost - commonAreasCost;

  if (totalAfterCommonAreas < 0) {
    throw new Error(`Errore: i costi parti comuni elettricità (€${commonAreasCost.toFixed(2)}) superano il totale bolletta (€${totalElecCost.toFixed(2)})`);
  }

  console.log(`💵 After common areas: €${totalElecCost.toFixed(2)} - €${commonAreasCost.toFixed(2)} = €${totalAfterCommonAreas.toFixed(2)}`);

  // STEP 2: Sottrai luci scale - OGNI unità con luci paga l'importo dalle impostazioni
  const staircaseLightsCostPerUnit = parseFloat(settings.staircase_lights_monthly || 0);
  const unitsWithLights = consumptions.filter(u => u.has_staircase_lights && u.is_inhabited);
  const numUnitsWithLights = unitsWithLights.length;
  const staircaseLightsTotal = staircaseLightsCostPerUnit * numUnitsWithLights;

  let totalAfterLights = totalAfterCommonAreas - staircaseLightsTotal;

  console.log(`\n💡 Staircase lights:`);
  console.log(`   Cost per unit (from settings): €${staircaseLightsCostPerUnit.toFixed(2)}`);
  console.log(`   Units with lights (inhabited): ${numUnitsWithLights}`);
  console.log(`   Total cost (${numUnitsWithLights} × €${staircaseLightsCostPerUnit.toFixed(2)}): €${staircaseLightsTotal.toFixed(2)}`);
  console.log(`   After lights: €${totalAfterLights.toFixed(2)}`);

  // STEP 3: Sottrai forfait acqua commerciali (solo per commerciali abitati)
  const commercialWaterForfait = consumptions
    .filter(u => u.is_commercial && u.is_inhabited)
    .reduce((sum, u) => sum + (u.monthly_water_fixed || 0), 0);

  let totalAfterCommercialWater = totalAfterLights - commercialWaterForfait;

  console.log(`\n💧 Commercial water forfait:`);
  console.log(`   Total: €${commercialWaterForfait.toFixed(2)}`);
  console.log(`   After commercial water: €${totalAfterCommercialWater.toFixed(2)}`);

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

  // VERIFICA CRITICA: La somma delle percentuali stagionali + involontaria DEVE essere 100%
  const seasonalSum = heatingPct + coolingPct + hotWaterPct + coldWaterPct;
  const totalSum = involuntaryPct + seasonalSum;

  console.log(`\n🔍 Verification:`);
  console.log(`   Involuntary: ${(involuntaryPct * 100).toFixed(0)}%`);
  console.log(`   Seasonal sum: ${(seasonalSum * 100).toFixed(0)}%`);
  console.log(`   TOTAL: ${(totalSum * 100).toFixed(0)}%`);

  if (Math.abs(totalSum - 1.0) > 0.01) {
    const error = `ERRORE CONFIGURAZIONE: Le percentuali (involontaria ${(involuntaryPct * 100).toFixed(0)}% + stagionali ${(seasonalSum * 100).toFixed(0)}% = ${(totalSum * 100).toFixed(0)}%) non sommano al 100%. Verifica le impostazioni.`;
    console.error(`\n❌ ${error}`);
    throw new Error(error);
  }
  console.log(`✅ Percentages verification passed (sum = 100%)`);

  // STEP 4: Calcola forfait stagionali per unità non abitate
  // Ora i forfait sono SOLO nelle unità (non più default in settings)
  const uninhabitedForfait = consumptions
    .filter(u => !u.is_inhabited)
    .reduce((sum, u) => {
      const unitForfait = season === 'summer'
        ? (u.monthly_elec_fixed_summer || 0)
        : (u.monthly_elec_fixed_winter || 0);
      return sum + unitForfait;
    }, 0);

  console.log(`\n💰 Total uninhabited units forfait (${season}): €${uninhabitedForfait.toFixed(2)}`);

  const costToDistribute = totalAfterCommercialWater - uninhabitedForfait;

  if (costToDistribute < 0) {
    throw new Error(`Errore: i forfettari delle unità non abitate (€${uninhabitedForfait.toFixed(2)}) superano il costo disponibile (€${totalAfterCommercialWater.toFixed(2)})`);
  }

  console.log(`💵 Cost to distribute among inhabited units: €${totalAfterCommercialWater.toFixed(2)} - €${uninhabitedForfait.toFixed(2)} = €${costToDistribute.toFixed(2)}`);

  // CRITICAL: Le percentuali stagionali sono SUL TOTALE, non sulla quota volontaria!
  // Quindi applico le percentuali direttamente a costToDistribute
  const involuntaryCost = costToDistribute * involuntaryPct;

  console.log(`\n💵 Cost breakdown (percentages applied to total €${costToDistribute.toFixed(2)}):`);
  console.log(`   Involuntary (${(involuntaryPct * 100).toFixed(0)}%): €${involuntaryCost.toFixed(2)}`);

  // Calcola totali SOLO per le unità ABITATE (quelle che partecipano alla ripartizione)
  const inhabitedUnits = consumptions.filter(u => u.is_inhabited);
  const uninhabitedUnits = consumptions.filter(u => !u.is_inhabited);

  // CRITICAL FIX: Superficie solo per unità residenziali (non commerciali)
  // Le unità commerciali NON partecipano alla quota involontaria
  const totalSurface = inhabitedUnits
    .filter(u => !u.is_commercial)
    .reduce((sum, u) => sum + u.surface_area, 0);

  console.log(`\n📏 Total surface (inhabited non-commercial only): ${totalSurface.toFixed(2)} m²`);
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

  // CRITICAL FIX: Applica percentuali stagionali sul TOTALE, non sulla quota volontaria!
  const heatingCost = costToDistribute * heatingPct;
  const coolingCost = costToDistribute * coolingPct;
  const hotWaterCost = costToDistribute * hotWaterPct;
  const coldWaterCost = costToDistribute * coldWaterPct;

  console.log(`\n💰 Cost allocation by category (percentages applied to total €${costToDistribute.toFixed(2)}):`);
  console.log(`   - Heating (${(heatingPct * 100).toFixed(0)}%): €${heatingCost.toFixed(2)}`);
  console.log(`   - Cooling (${(coolingPct * 100).toFixed(0)}%): €${coolingCost.toFixed(2)}`);
  console.log(`   - Hot Water (${(hotWaterPct * 100).toFixed(0)}%): €${hotWaterCost.toFixed(2)}`);
  console.log(`   - Cold Water (${(coldWaterPct * 100).toFixed(0)}%): €${coldWaterCost.toFixed(2)}`);
  console.log(`   - Involuntary: €${involuntaryCost.toFixed(2)}`);
  console.log(`   - SUM: €${(involuntaryCost + heatingCost + coolingCost + hotWaterCost + coldWaterCost).toFixed(2)} (should be €${costToDistribute.toFixed(2)})`);

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

    // UNITÀ NON ABITATE: pagano SOLO il forfettario stagionale, NON partecipano alla ripartizione
    if (!unit.is_inhabited) {
      const forfait = season === 'summer'
        ? (unit.monthly_elec_fixed_summer || 0)
        : (unit.monthly_elec_fixed_winter || 0);
      console.log(`      ⚠️ Uninhabited unit: pays ONLY €${forfait.toFixed(2)} forfait (${season}) - does NOT participate in distribution`);

      results[unit.unit_id] = {
        staircase_lights: 0,
        commercial_water: 0,
        fixed: forfait,
        heating: 0,
        cooling: 0,
        hot_water: 0,
        cold_water: 0
      };
      continue; // Skip to next unit
    }

    // UNITÀ ABITATE: partecipano alla ripartizione normale

    // Quota involontaria (base superficie) - SOLO per unità residenziali (non commerciali)
    // Le unità commerciali NON partecipano alla quota involontaria
    const unitInvoluntary = (!unit.is_commercial && totalSurface > 0)
      ? (adjustedInvoluntaryCost * unit.surface_area) / totalSurface
      : 0;

    if (unit.is_commercial) {
      console.log(`      Commercial unit: skips involuntary quota (pays only water forfait + ACF consumption)`);
    } else {
      console.log(`      Involuntary: €${adjustedInvoluntaryCost.toFixed(2)} × ${unit.surface_area.toFixed(2)}/${totalSurface.toFixed(2)} = €${unitInvoluntary.toFixed(2)}`);
    }
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

    // Calcola staircase lights per questa unità
    const unitStaircaseLights = unit.has_staircase_lights ? staircaseLightsCostPerUnit : 0;

    // Calcola commercial water forfait per questa unità
    const unitCommercialWater = (unit.is_commercial && unit.is_inhabited) ? (unit.monthly_water_fixed || 0) : 0;

    const unitTotal = unitStaircaseLights + unitCommercialWater + unitInvoluntary + unitHeating + unitCooling + unitHotWater + unitColdWater;
    console.log(`      ➡️ TOTAL FOR UNIT: €${unitTotal.toFixed(2)}`);

    results[unit.unit_id] = {
      staircase_lights: unitStaircaseLights,
      commercial_water: unitCommercialWater,
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
  console.log(`💰 STAIRCASE LIGHTS: €${staircaseLightsTotal.toFixed(2)}`);
  console.log(`💰 COMMERCIAL WATER FORFAIT: €${commercialWaterForfait.toFixed(2)}`);
  console.log(`💰 FORFAIT FROM UNINHABITED UNITS: €${uninhabitedForfait.toFixed(2)}`);
  console.log(`💰 COMMON AREAS: €${commonAreasCost.toFixed(2)}`);

  const grandTotal = commonAreasCost + staircaseLightsTotal + commercialWaterForfait + uninhabitedForfait + distributedToInhabited;

  console.log(`💰 GRAND TOTAL: €${grandTotal.toFixed(2)}`);
  console.log(`💰 EXPECTED (from bill): €${totalElecCost.toFixed(2)}`);
  console.log(`💰 DIFFERENCE: €${(totalElecCost - grandTotal).toFixed(2)}`);

  if (Math.abs(totalElecCost - grandTotal) > 0.02) {
    console.log(`\n❌ ERROR: Money lost/gained in electricity distribution!`);
    console.log(`   Common areas: €${commonAreasCost.toFixed(2)}`);
    console.log(`   Staircase lights: €${staircaseLightsTotal.toFixed(2)}`);
    console.log(`   Commercial water forfait: €${commercialWaterForfait.toFixed(2)}`);
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

    // Determina la stagione
    const season = getSeason(monthNum, settings);
    console.log(`🌡️ Season: ${season}`);

    // Ripartisci costi
    let gasCosts = {};
    let elecCosts = {};

    if (type === 'gas' || type === 'both') {
      gasCosts = splitGasCosts(totalGasCost, consumptions, settings, season);
    }

    if (type === 'electricity' || type === 'both') {
      elecCosts = splitElectricityCosts(totalElecCost, consumptions, settings, season);
    }

    // Combina risultati
    const results = [];
    for (const unit of consumptions) {
      const gas = gasCosts[unit.unit_id] || { heating: 0, hot_water: 0 };
      const elec = elecCosts[unit.unit_id] || { staircase_lights: 0, commercial_water: 0, fixed: 0, heating: 0, cooling: 0, hot_water: 0, cold_water: 0 };

      const total = gas.heating + gas.hot_water +
                    elec.staircase_lights + elec.commercial_water +
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
        readings: unit.readings || [], // Letture contabilizzatori
        costs: {
          gas_heating: gas.heating,
          gas_hot_water: gas.hot_water,
          elec_staircase_lights: elec.staircase_lights,
          elec_commercial_water: elec.commercial_water,
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
      season: season,
      total_gas_cost: totalGasCost,
      total_elec_cost: totalElecCost,
      total_cost: totalGasCost + totalElecCost,
      common_areas: {
        gas: parseFloat(settings.common_areas_gas_monthly || 0),
        electricity: parseFloat(settings.common_areas_elec_monthly || 0)
      },
      settings: {
        gas_involuntary_pct: settings.gas_involuntary_pct,
        gas_winter_heating_pct: settings.gas_winter_heating_pct,
        gas_winter_hot_water_pct: settings.gas_winter_hot_water_pct,
        gas_summer_hot_water_pct: settings.gas_summer_hot_water_pct,
        elec_involuntary_pct: settings.elec_involuntary_pct,
        winter_heating_pct: settings.winter_heating_pct,
        winter_hot_water_pct: settings.winter_hot_water_pct,
        winter_cold_water_pct: settings.winter_cold_water_pct,
        summer_cooling_pct: settings.summer_cooling_pct,
        summer_hot_water_pct: settings.summer_hot_water_pct,
        summer_cold_water_pct: settings.summer_cold_water_pct
      },
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
