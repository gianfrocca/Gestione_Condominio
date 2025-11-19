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

      // Spiegazione metodologia di calcolo
      doc.fontSize(11).font('Helvetica-Bold').text('MODALITÀ DI CALCOLO', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');

      if (data.type === 'gas' || data.type === 'both') {
        doc.font('Helvetica-Bold').text('METANO (40% quota fissa + 60% consumi):');
        doc.font('Helvetica');
        doc.text('  • Quota Fissa (40%): Divisa per superficie tra unità abitate');
        doc.text('  • Quota Consumi (60%): Proporzionale ai consumi acqua calda');
        doc.text('  • Ripartizione: 90% Acqua Calda Sanitaria + 10% Riscaldamento');
        doc.moveDown(0.3);
      }

      if (data.type === 'electricity' || data.type === 'both') {
        doc.font('Helvetica-Bold').text('ENERGIA ELETTRICA (40% quota fissa + 60% stagionale):');
        doc.font('Helvetica');
        doc.text('  • Quota Fissa (40%): Divisa per superficie (non abitati al 30%)');
        doc.text('  • Quota Variabile (60%): Stagionale');
        doc.text('    - Inverno: 30% Riscaldamento + 30% ACS + 40% ACF');
        doc.text('    - Estate: 30% Raffrescamento + 30% ACS + 40% ACF');
        doc.moveDown(0.3);
      }

      doc.font('Helvetica-Bold').text('COSTI FISSI:');
      doc.font('Helvetica');
      doc.text('  • Luci scale: ripartito su 3 appartamenti');
      doc.text('  • Unità commerciale: quota fissa acqua');
      doc.moveDown(0.3);

      doc.fontSize(8).fillColor('#666');
      doc.text('ACS = Acqua Calda Sanitaria | ACF = Acqua Fredda', { align: 'center' });
      doc.fillColor('black');
      doc.moveDown(1);

      // Linea separatrice
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Riepilogo totali
      doc.fontSize(12).font('Helvetica-Bold').text('RIEPILOGO GENERALE');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      if (data.type === 'gas' || data.type === 'both') {
        doc.text(`Totale Metano: €${data.total_gas_cost.toFixed(2)}`);
      }
      if (data.type === 'electricity' || data.type === 'both') {
        doc.text(`Totale Energia Elettrica: €${data.total_elec_cost.toFixed(2)}`);
      }
      doc.font('Helvetica-Bold').text(`Totale Complessivo: €${data.total_cost.toFixed(2)}`);
      doc.font('Helvetica');
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

        // Consumi
        doc.fontSize(10).font('Helvetica-Bold').text('Consumi:');
        doc.fontSize(9).font('Helvetica');
        doc.text(`  Riscaldamento: ${unit.consumptions.heating.toFixed(2)} kWh`);
        doc.text(`  Acqua Calda: ${unit.consumptions.hot_water.toFixed(2)} m³`);
        doc.text(`  Acqua Fredda: ${unit.consumptions.cold_water.toFixed(2)} m³`);
        doc.moveDown(0.3);

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
          doc.text(`  Quota Fissa: €${unit.costs.elec_fixed.toFixed(2)}`);
          doc.text(`  Riscaldamento: €${unit.costs.elec_heating.toFixed(2)}`);
          doc.text(`  Raffrescamento: €${unit.costs.elec_cooling.toFixed(2)}`);
          doc.text(`  Acqua Calda: €${unit.costs.elec_hot_water.toFixed(2)}`);
          doc.text(`  Acqua Fredda: €${unit.costs.elec_cold_water.toFixed(2)}`);
          const totalElec = unit.costs.elec_fixed + unit.costs.elec_heating +
                           unit.costs.elec_cooling + unit.costs.elec_hot_water +
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
