import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Genera PDF report per ripartizione mensile
 * @param {object} data - Dati ripartizione da calculateMonthlySplit
 * @param {string} outputPath - Path dove salvare il PDF
 * @returns {Promise<string>} Path del file generato
 */
export async function generateMonthlyReport(data, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('Ripartizione Spese Condominiali', { align: 'center' });
      doc.moveDown(0.5);

      // Periodo
      const formatDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
      };

      doc.fontSize(14).text(`Periodo: ${formatDate(data.period.from)} - ${formatDate(data.period.to)}`, { align: 'center' });

      // Tipo calcolo
      const typeLabels = {
        'both': 'Metano + Energia Elettrica',
        'gas': 'Solo Metano',
        'electricity': 'Solo Energia Elettrica'
      };
      doc.fontSize(12).text(`Tipo: ${typeLabels[data.type] || 'Completo'}`, { align: 'center' });
      doc.moveDown(1.5);

      // Spiegazione metodologia di calcolo DETTAGLIATA
      const season = data.season || 'winter';
      const seasonName = season === 'summer' ? 'ESTATE' : 'INVERNO';

      doc.fontSize(11).font('Helvetica-Bold').text('CRITERI DI RIPARTIZIONE', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');
      doc.text(`Stagione rilevata: ${seasonName}`, { align: 'center' });
      doc.moveDown(0.5);

      if (data.type === 'gas' || data.type === 'both') {
        doc.font('Helvetica-Bold').text('🔥 METANO (Ripartizione Stagionale):');
        doc.font('Helvetica');

        if (season === 'winter') {
          doc.text(`  INVERNO (attuale):`);
          doc.text(`  • ${data.settings?.gas_involuntary_pct || 40}% Quota involontaria → distribuita per m²`);
          doc.text(`  • ${data.settings?.gas_winter_heating_pct || 40}% Riscaldamento → distribuita per consumi riscaldamento`);
          doc.text(`  • ${data.settings?.gas_winter_hot_water_pct || 20}% Acqua calda → distribuita per consumi ACS`);
        } else {
          doc.text(`  ESTATE (attuale):`);
          doc.text(`  • ${data.settings?.gas_involuntary_pct || 40}% Quota involontaria → distribuita per m²`);
          doc.text(`  • ${data.settings?.gas_summer_hot_water_pct || 60}% Acqua calda → distribuita per consumi ACS`);
        }
        doc.moveDown(0.3);
      }

      if (data.type === 'electricity' || data.type === 'both') {
        doc.font('Helvetica-Bold').text('⚡ ENERGIA ELETTRICA (Ripartizione Stagionale):');
        doc.font('Helvetica');

        if (season === 'winter') {
          doc.text(`  INVERNO (attuale):`);
          doc.text(`  • ${data.settings?.elec_involuntary_pct || 40}% Quota involontaria → distribuita per m²`);
          doc.text(`  • ${data.settings?.winter_heating_pct || 30}% Riscaldamento → distribuita per consumi riscaldamento`);
          doc.text(`  • ${data.settings?.winter_hot_water_pct || 20}% Acqua calda → distribuita per consumi ACS`);
          doc.text(`  • ${data.settings?.winter_cold_water_pct || 10}% Acqua fredda → distribuita per consumi ACF`);
        } else {
          doc.text(`  ESTATE (attuale):`);
          doc.text(`  • ${data.settings?.elec_involuntary_pct || 40}% Quota involontaria → distribuita per m²`);
          doc.text(`  • ${data.settings?.summer_cooling_pct || 20}% Raffrescamento → distribuita per consumi`);
          doc.text(`  • ${data.settings?.summer_hot_water_pct || 20}% Acqua calda → distribuita per consumi ACS`);
          doc.text(`  • ${data.settings?.summer_cold_water_pct || 20}% Acqua fredda → distribuita per consumi ACF`);
        }
        doc.moveDown(0.3);
      }

      doc.font('Helvetica-Bold').text('📋 NOTE:');
      doc.font('Helvetica');
      doc.text('  • Le percentuali si applicano sul totale della bolletta');
      doc.text('  • ACS = Acqua Calda Sanitaria | ACF = Acqua Fredda');
      doc.text('  • Unità non abitate pagano forfait stagionale fisso');
      doc.moveDown(0.3);

      doc.fontSize(8).fillColor('#666');
      doc.text(`Le percentuali possono variare tra inverno ed estate secondo le impostazioni`, { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(1);

      // Linea separatrice
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // BREAKDOWN BOLLETTE CON COSTI PARTI COMUNI
      doc.fontSize(12).font('Helvetica-Bold').text('RIEPILOGO BOLLETTE E COSTI FISSI');
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');

      const commonGas = data.common_areas?.gas || 0;
      const commonElec = data.common_areas?.electricity || 0;

      if (data.type === 'gas' || data.type === 'both') {
        doc.font('Helvetica-Bold').text('METANO:');
        doc.font('Helvetica');
        doc.text(`  Bollette Totali: €${data.total_gas_cost.toFixed(2)}`);
        if (commonGas > 0) {
          doc.text(`  - Costi Parti Comuni (caldaia): -€${commonGas.toFixed(2)}`);
        }
        // Calcola forfait totale (sommando da tutte le unità non abitate)
        const gasForfait = data.units
          .filter(u => !u.is_inhabited && !u.is_commercial)
          .reduce((sum, u) => sum + u.costs.gas_heating + u.costs.gas_hot_water, 0);
        if (gasForfait > 0) {
          doc.text(`  - Forfait Unità Non Abitate: -€${gasForfait.toFixed(2)}`);
        }
        const gasToDistribute = data.total_gas_cost - commonGas - gasForfait;
        doc.font('Helvetica-Bold').text(`  = Da distribuire tra unità abitate: €${gasToDistribute.toFixed(2)}`);
        doc.font('Helvetica');
        doc.moveDown(0.3);
      }

      if (data.type === 'electricity' || data.type === 'both') {
        doc.font('Helvetica-Bold').text('ENERGIA ELETTRICA:');
        doc.font('Helvetica');
        doc.text(`  Bollette Totali: €${data.total_elec_cost.toFixed(2)}`);
        if (commonElec > 0) {
          doc.text(`  - Costi Parti Comuni (scale+ascensore): -€${commonElec.toFixed(2)}`);
        }
        // Luci scale
        const staircaseLights = data.units.reduce((sum, u) => sum + (u.costs.elec_staircase_lights || 0), 0);
        if (staircaseLights > 0) {
          doc.text(`  - Luci Scale (divise tra unità con luci): -€${staircaseLights.toFixed(2)}`);
        }
        // Forfait acqua commerciale
        const commercialWater = data.units
          .filter(u => u.is_commercial && u.is_inhabited)
          .reduce((sum, u) => sum + (u.costs.elec_commercial_water || 0), 0);
        if (commercialWater > 0) {
          doc.text(`  - Forfait Acqua Commerciale: -€${commercialWater.toFixed(2)}`);
        }
        // Calcola forfait totale appartamenti non abitati
        const elecForfait = data.units
          .filter(u => !u.is_inhabited)
          .reduce((sum, u) => sum + u.costs.elec_fixed, 0);
        if (elecForfait > 0) {
          doc.text(`  - Forfait Unità Non Abitate: -€${elecForfait.toFixed(2)}`);
        }
        const elecToDistribute = data.total_elec_cost - commonElec - staircaseLights - commercialWater - elecForfait;
        doc.font('Helvetica-Bold').text(`  = Da distribuire tra unità abitate: €${elecToDistribute.toFixed(2)}`);
        doc.font('Helvetica');
        doc.moveDown(0.3);
      }

      doc.font('Helvetica-Bold').fontSize(11).text(`TOTALE PERIODO: €${data.total_cost.toFixed(2)}`);
      doc.font('Helvetica').fontSize(9);
      doc.moveDown(1);

      // Linea separatrice
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Dettaglio per unità
      for (const unit of data.units) {
        // Controlla se c'è spazio, altrimenti nuova pagina
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`${unit.unit_number} - ${unit.unit_name}`, { underline: true });
        doc.moveDown(0.3);

        doc.fontSize(9).font('Helvetica');
        doc.text(`Superficie: ${unit.surface_area} mq | Stato: ${unit.is_inhabited ? 'Abitato' : 'Non abitato'}`);

        if (unit.is_commercial) {
          doc.text('Tipo: Commerciale');
        }

        doc.moveDown(0.5);

        // TABELLA LETTURE CONTABILIZZATORI
        if (unit.readings && unit.readings.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold').text('Letture Contabilizzatori:');
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');

          // Header tabella
          const startX = 60;
          let y = doc.y;
          doc.text('Tipo', startX, y, { width: 70 });
          doc.text('Codice', startX + 70, y, { width: 50 });
          doc.text('Iniziale', startX + 120, y, { width: 80 });
          doc.text('Finale', startX + 200, y, { width: 80 });
          doc.text('Consumo', startX + 280, y, { width: 60 });
          doc.moveDown(0.3);

          // Linea sotto header
          doc.moveTo(startX, doc.y).lineTo(startX + 340, doc.y).stroke();
          doc.moveDown(0.2);

          // Righe dati
          for (const reading of unit.readings) {
            y = doc.y;
            const typeLabel = {
              'heating': 'Riscaldamento',
              'hot_water': 'Acqua Calda',
              'cold_water': 'Acqua Fredda'
            }[reading.meter_type] || reading.meter_type;

            const formatDate = (dateStr) => {
              if (!dateStr) return 'N/A';
              const [yy, mm, dd] = dateStr.split('-');
              return `${dd}/${mm}/${yy}`;
            };

            doc.text(typeLabel, startX, y, { width: 70 });
            doc.text(reading.meter_code || 'N/A', startX + 70, y, { width: 50 });
            doc.text(`${reading.start_value.toFixed(1)} (${formatDate(reading.start_date)})`, startX + 120, y, { width: 80, lineBreak: false });
            doc.text(`${reading.end_value.toFixed(1)} (${formatDate(reading.end_date)})`, startX + 200, y, { width: 80, lineBreak: false });
            doc.text(`${reading.consumption.toFixed(1)}`, startX + 280, y, { width: 60 });
            doc.moveDown(0.4);
          }
          doc.moveDown(0.3);
        } else {
          // Consumi (vecchio formato se non ci sono letture)
          doc.fontSize(10).font('Helvetica-Bold').text('Consumi:');
          doc.fontSize(9).font('Helvetica');
          doc.text(`  Riscaldamento: ${unit.consumptions.heating.toFixed(2)} kWh`);
          doc.text(`  Acqua Calda: ${unit.consumptions.hot_water.toFixed(2)} m³`);
          doc.text(`  Acqua Fredda: ${unit.consumptions.cold_water.toFixed(2)} m³`);
          doc.moveDown(0.3);
        }

        // Costi Gas (solo se richiesti)
        if (data.type === 'gas' || data.type === 'both') {
          doc.fontSize(10).font('Helvetica-Bold').text('Metano:');
          doc.fontSize(9).font('Helvetica');
          doc.text(`  Riscaldamento: €${unit.costs.gas_heating.toFixed(2)}`);
          doc.text(`  Acqua Calda: €${unit.costs.gas_hot_water.toFixed(2)}`);
          const totalGas = unit.costs.gas_heating + unit.costs.gas_hot_water;
          doc.font('Helvetica-Bold').text(`  Totale Gas: €${totalGas.toFixed(2)}`);
          doc.font('Helvetica');
          doc.moveDown(0.3);
        }

        // Costi Energia (solo se richiesti)
        if (data.type === 'electricity' || data.type === 'both') {
          doc.fontSize(10).font('Helvetica-Bold').text('Energia Elettrica:');
          doc.fontSize(9).font('Helvetica');

          // Luci scale (se presenti)
          if (unit.costs.elec_staircase_lights > 0) {
            doc.text(`  Luci Scale: €${unit.costs.elec_staircase_lights.toFixed(2)}`);
          }

          // Forfait acqua commerciale (se presente)
          if (unit.costs.elec_commercial_water > 0) {
            doc.text(`  Forfait Acqua Commerciale: €${unit.costs.elec_commercial_water.toFixed(2)}`);
          }

          // Quota fissa (rinominata in base al tipo)
          if (unit.costs.elec_fixed > 0) {
            if (!unit.is_inhabited) {
              doc.text(`  Forfait Appartamento Non Abitato: €${unit.costs.elec_fixed.toFixed(2)}`);
            } else {
              doc.text(`  Quota Involontaria (per mq): €${unit.costs.elec_fixed.toFixed(2)}`);
            }
          }

          // Quote variabili
          if (unit.costs.elec_heating > 0) {
            doc.text(`  Riscaldamento: €${unit.costs.elec_heating.toFixed(2)}`);
          }
          if (unit.costs.elec_cooling > 0) {
            doc.text(`  Raffrescamento: €${unit.costs.elec_cooling.toFixed(2)}`);
          }
          if (unit.costs.elec_hot_water > 0) {
            doc.text(`  Acqua Calda: €${unit.costs.elec_hot_water.toFixed(2)}`);
          }
          if (unit.costs.elec_cold_water > 0) {
            doc.text(`  Acqua Fredda (consumi): €${unit.costs.elec_cold_water.toFixed(2)}`);
          }

          // Calcolo totale CORRETTO includendo TUTTI i campi
          const totalElec = (unit.costs.elec_staircase_lights || 0) +
                           (unit.costs.elec_commercial_water || 0) +
                           unit.costs.elec_fixed +
                           unit.costs.elec_heating +
                           unit.costs.elec_cooling +
                           unit.costs.elec_hot_water +
                           unit.costs.elec_cold_water;
          doc.font('Helvetica-Bold').text(`  Totale Elettricità: €${totalElec.toFixed(2)}`);
          doc.font('Helvetica');
          doc.moveDown(0.5);
        }

        // Totale unità
        doc.fontSize(11).font('Helvetica-Bold');
        doc.fillColor('#2563eb');
        doc.text(`TOTALE DA PAGARE: €${unit.costs.total.toFixed(2)}`);
        doc.fillColor('black');
        doc.font('Helvetica');
        doc.moveDown(1);

        // Linea separatrice
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);
      }

      // TABELLA RIEPILOGO FINALE
      if (doc.y > 600) {
        doc.addPage();
      }

      doc.fontSize(14).font('Helvetica-Bold').text('TABELLA RIEPILOGO', { align: 'center' });
      doc.moveDown(1);

      // Header tabella
      doc.fontSize(10).font('Helvetica-Bold');
      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 250;
      const col3 = 450;

      doc.text('Unità', col1, tableTop);
      doc.text('Nome', col2, tableTop);
      doc.text('Totale', col3, tableTop, { align: 'right' });
      doc.moveDown(0.5);

      // Linea sotto header
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      // Righe
      doc.fontSize(9).font('Helvetica');
      let sumUnits = 0;

      for (const unit of data.units) {
        const y = doc.y;
        doc.text(unit.unit_number, col1, y);
        doc.text(unit.unit_name, col2, y);
        doc.text(`€${unit.costs.total.toFixed(2)}`, col3, y, { align: 'right' });
        sumUnits += unit.costs.total;
        doc.moveDown(0.5);

        // Nuova pagina se necessario
        if (doc.y > 700) {
          doc.addPage();
          doc.moveDown(1);
        }
      }

      // Linea prima del totale
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // Totale unità
      doc.fontSize(10).font('Helvetica-Bold');
      const totalY = doc.y;
      doc.text('SOMMA UNITÀ:', col1, totalY);
      doc.text(`€${sumUnits.toFixed(2)}`, col3, totalY, { align: 'right' });
      doc.moveDown(0.8);

      // Totale bollette
      const billTotal = data.total_gas_cost + data.total_elec_cost;
      const billY = doc.y;
      doc.text('TOTALE BOLLETTE:', col1, billY);
      doc.text(`€${billTotal.toFixed(2)}`, col3, billY, { align: 'right' });
      doc.moveDown(0.8);

      // Differenza (dovrebbe essere 0)
      const diff = Math.abs(sumUnits - billTotal);
      const diffY = doc.y;
      if (diff < 0.02) {
        doc.fillColor('#10b981'); // Verde se OK
        doc.text('VERIFICA:', col1, diffY);
        doc.text('✓ OK', col3, diffY, { align: 'right' });
      } else {
        doc.fillColor('#ef4444'); // Rosso se problema
        doc.text('DIFFERENZA:', col1, diffY);
        doc.text(`€${diff.toFixed(2)}`, col3, diffY, { align: 'right' });
      }
      doc.fillColor('black');
      doc.moveDown(1);

      // Nota verifica
      doc.fontSize(8).font('Helvetica').fillColor('#666');
      doc.text('La somma delle unità deve corrispondere al totale delle bollette del periodo.', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(2);

      // Footer
      doc.fontSize(8).text(
        `Report generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
        50,
        doc.y,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Genera PDF report annuale
 * @param {object} data - Dati ripartizione annuale
 * @param {string} year - Anno
 * @param {string} outputPath - Path dove salvare il PDF
 * @returns {Promise<string>} Path del file generato
 */
export async function generateAnnualReport(data, year, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('Riepilogo Annuale Spese Condominiali', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Anno ${year}`, { align: 'center' });
      doc.moveDown(2);

      // Calcola totali
      const totalGas = data.reduce((sum, u) => sum + u.total_gas, 0);
      const totalElec = data.reduce((sum, u) => sum + u.total_elec, 0);
      const totalCost = data.reduce((sum, u) => sum + u.total_cost, 0);

      // Riepilogo generale
      doc.fontSize(12).font('Helvetica-Bold').text('RIEPILOGO GENERALE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Totale Metano: €${totalGas.toFixed(2)}`);
      doc.text(`Totale Energia Elettrica: €${totalElec.toFixed(2)}`);
      doc.font('Helvetica-Bold').text(`Totale Complessivo: €${totalCost.toFixed(2)}`);
      doc.font('Helvetica');
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Tabella per unità
      doc.fontSize(12).font('Helvetica-Bold').text('DETTAGLIO PER UNITÀ');
      doc.moveDown(1);

      for (const unit of data) {
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`${unit.unit_number} - ${unit.unit_name}`);
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        doc.text(`  Mesi calcolati: ${unit.months_count}`);
        doc.text(`  Totale Gas: €${unit.total_gas.toFixed(2)}`);
        doc.text(`  Totale Elettricità: €${unit.total_elec.toFixed(2)}`);
        doc.font('Helvetica-Bold').text(`  Totale Anno: €${unit.total_cost.toFixed(2)}`);
        doc.font('Helvetica');
        doc.moveDown(0.5);

        doc.text(`  Media mensile: €${(unit.total_cost / unit.months_count).toFixed(2)}`);
        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
      }

      // Footer
      doc.fontSize(8).text(
        `Report generato il ${new Date().toLocaleDateString('it-IT')}`,
        50,
        750,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  generateMonthlyReport,
  generateAnnualReport
};
