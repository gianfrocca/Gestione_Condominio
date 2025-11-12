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
 * Calcola i consumi per unità e tipo
 * @param {string} month - Mese nel formato 'YYYY-MM'
 * @returns {Promise<object>} Consumi per unità
 */
async function calculateConsumptions(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const currentDate = new Date(year, monthNum - 1, 1);
  const previousDate = new Date(year, monthNum - 2, 1);

  const currentMonth = currentDate.toISOString().slice(0, 7);
  const previousMonth = previousDate.toISOString().slice(0, 7);

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
      // Lettura mese corrente
      const currentReading = await getQuery(
        `SELECT value FROM readings
         WHERE meter_id = ? AND strftime('%Y-%m', reading_date) = ?
         ORDER BY reading_date DESC LIMIT 1`,
        [unit.meter_id, currentMonth]
      );

      // Lettura mese precedente
      const previousReading = await getQuery(
        `SELECT value FROM readings
         WHERE meter_id = ? AND strftime('%Y-%m', reading_date) = ?
         ORDER BY reading_date DESC LIMIT 1`,
        [unit.meter_id, previousMonth]
      );

      if (currentReading && previousReading) {
        const consumption = currentReading.value - previousReading.value;

        switch (unit.meter_type) {
          case 'heating':
            consumptions[unit.id].heating = consumption;
            break;
          case 'hot_water':
            consumptions[unit.id].hot_water = consumption;
            break;
          case 'cold_water':
            consumptions[unit.id].cold_water = consumption;
            break;
        }
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

  const results = {};

  for (const unit of consumptions) {
    if (unit.is_commercial) {
      results[unit.unit_id] = { heating: 0, hot_water: 0 };
      continue;
    }

    // Quota involontaria: solo se abitato
    let unitInvoluntary = 0;
    if (unit.is_inhabited && totalInhabitedSurface > 0) {
      unitInvoluntary = (involuntaryCost * unit.surface_area) / totalInhabitedSurface;
    }

    // Quota volontaria: proporzionale ai consumi ACS
    let unitVoluntary = 0;
    if (totalHotWaterConsumption > 0) {
      unitVoluntary = (voluntaryCost * unit.hot_water) / totalHotWaterConsumption;
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

  // Calcola totali per ripartizioni proporzionali
  const totalSurface = consumptions.reduce((sum, u) => {
    // Se non abitato, partecipa con peso ridotto (es. 30%)
    const weight = u.is_inhabited ? 1 : 0.3;
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

  const results = {};

  for (const unit of consumptions) {
    // Quota involontaria (base superficie)
    const surfaceWeight = unit.is_inhabited ? 1 : 0.3;
    const weightedSurface = unit.surface_area * surfaceWeight;
    const unitInvoluntary = totalSurface > 0
      ? (involuntaryCost * weightedSurface) / totalSurface
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
 * Calcola la ripartizione completa per un mese
 * @param {string} month - Mese nel formato 'YYYY-MM'
 * @returns {Promise<object>} Ripartizione completa
 */
export async function calculateMonthlySplit(month) {
  try {
    // Carica impostazioni
    const settingsRows = await allQuery('SELECT key, value FROM settings');
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    // Ottieni bollette del mese
    const gasBill = await getQuery(
      `SELECT amount FROM bills
       WHERE type = 'gas' AND strftime('%Y-%m', bill_date) = ?
       ORDER BY bill_date DESC LIMIT 1`,
      [month]
    );

    const elecBill = await getQuery(
      `SELECT amount FROM bills
       WHERE type = 'electricity' AND strftime('%Y-%m', bill_date) = ?
       ORDER BY bill_date DESC LIMIT 1`,
      [month]
    );

    if (!gasBill || !elecBill) {
      throw new Error('Bollette non trovate per il mese specificato');
    }

    // Calcola consumi
    const consumptions = await calculateConsumptions(month);

    if (consumptions.length === 0) {
      throw new Error('Nessun dato di consumo trovato per il mese specificato');
    }

    // Ripartisci costi
    const monthNum = parseInt(month.split('-')[1]);
    const gasCosts = splitGasCosts(gasBill.amount, consumptions, settings);
    const elecCosts = splitElectricityCosts(elecBill.amount, consumptions, settings, monthNum);

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

    return {
      month: month,
      total_gas_cost: gasBill.amount,
      total_elec_cost: elecBill.amount,
      total_cost: gasBill.amount + elecBill.amount,
      units: results
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
