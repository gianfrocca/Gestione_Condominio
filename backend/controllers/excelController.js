import ExcelJS from 'exceljs';
import { calculateMonthlySplit } from '../utils/calculator.js';

/**
 * Esporta il report di ripartizione in formato Excel
 */
export const exportReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, type = 'both' } = req.query;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: 'dateFrom e dateTo sono obbligatori' });
    }

    // Calcola la ripartizione
    const data = await calculateMonthlySplit(dateFrom, dateTo, type);

    // Crea un nuovo workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestione Condominio';
    workbook.created = new Date();

    // Aggiungi foglio riepilogo
    const summarySheet = workbook.addWorksheet('Riepilogo');

    // Header styling
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } },
      alignment: { vertical: 'middle', horizontal: 'center' }
    };

    // Titolo
    summarySheet.mergeCells('A1:E1');
    summarySheet.getCell('A1').value = `Report Ripartizione Spese - ${dateFrom} / ${dateTo}`;
    summarySheet.getCell('A1').font = { size: 16, bold: true };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    // Informazioni generali
    summarySheet.getCell('A3').value = 'Stagione:';
    summarySheet.getCell('B3').value = data.season === 'summer' ? 'Estate' : 'Inverno';
    summarySheet.getCell('A4').value = 'Totale Gas:';
    summarySheet.getCell('B4').value = data.total_gas_cost;
    summarySheet.getCell('B4').numFmt = '€#,##0.00';
    summarySheet.getCell('A5').value = 'Totale Elettricità:';
    summarySheet.getCell('B5').value = data.total_elec_cost;
    summarySheet.getCell('B5').numFmt = '€#,##0.00';
    summarySheet.getCell('A6').value = 'Totale Complessivo:';
    summarySheet.getCell('B6').value = data.total_cost;
    summarySheet.getCell('B6').numFmt = '€#,##0.00';
    summarySheet.getCell('B6').font = { bold: true };

    // Tabella unità
    summarySheet.getCell('A9').value = 'Unità';
    summarySheet.getCell('B9').value = 'Inquilino';
    summarySheet.getCell('C9').value = 'Superficie (m²)';
    summarySheet.getCell('D9').value = 'Costi Totali';
    summarySheet.getCell('E9').value = 'Note';

    // Applica stile header
    ['A9', 'B9', 'C9', 'D9', 'E9'].forEach(cell => {
      summarySheet.getCell(cell).style = headerStyle;
    });

    let row = 10;
    data.units.forEach(unit => {
      summarySheet.getCell(`A${row}`).value = unit.unit_number;
      summarySheet.getCell(`B${row}`).value = unit.unit_name;
      summarySheet.getCell(`C${row}`).value = unit.surface_area;
      summarySheet.getCell(`D${row}`).value = unit.costs.total;
      summarySheet.getCell(`D${row}`).numFmt = '€#,##0.00';
      summarySheet.getCell(`E${row}`).value = unit.is_inhabited ? 'Abitato' : 'Non abitato';

      if (!unit.is_inhabited) {
        summarySheet.getCell(`E${row}`).font = { color: { argb: 'FF999999' } };
      }
      if (unit.is_commercial) {
        summarySheet.getCell(`E${row}`).value += ' (Commerciale)';
      }

      row++;
    });

    // Auto-width columns
    summarySheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: false }, cell => {
        const cellValue = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = Math.min(maxLength + 2, 50);
    });

    // Foglio dettaglio unità
    const detailSheet = workbook.addWorksheet('Dettaglio Unità');

    // Header
    const detailHeaders = [
      'Unità', 'Inquilino', 'Superficie', 'Abitato', 'Commerciale',
      'Gas Risc.', 'Gas ACS',
      'Elec Luci Scale', 'Elec Forfait Acqua', 'Elec Fissa', 'Elec Risc.', 'Elec Raffr.', 'Elec ACS', 'Elec ACF',
      'TOTALE'
    ];

    detailHeaders.forEach((header, idx) => {
      const cell = detailSheet.getCell(1, idx + 1);
      cell.value = header;
      cell.style = headerStyle;
    });

    row = 2;
    data.units.forEach(unit => {
      detailSheet.getCell(row, 1).value = unit.unit_number;
      detailSheet.getCell(row, 2).value = unit.unit_name;
      detailSheet.getCell(row, 3).value = unit.surface_area;
      detailSheet.getCell(row, 4).value = unit.is_inhabited ? 'Sì' : 'No';
      detailSheet.getCell(row, 5).value = unit.is_commercial ? 'Sì' : 'No';

      // Gas
      detailSheet.getCell(row, 6).value = unit.costs.gas_heating;
      detailSheet.getCell(row, 6).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 7).value = unit.costs.gas_hot_water;
      detailSheet.getCell(row, 7).numFmt = '€#,##0.00';

      // Elettricità
      detailSheet.getCell(row, 8).value = unit.costs.elec_staircase_lights;
      detailSheet.getCell(row, 8).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 9).value = unit.costs.elec_commercial_water;
      detailSheet.getCell(row, 9).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 10).value = unit.costs.elec_fixed;
      detailSheet.getCell(row, 10).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 11).value = unit.costs.elec_heating;
      detailSheet.getCell(row, 11).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 12).value = unit.costs.elec_cooling;
      detailSheet.getCell(row, 12).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 13).value = unit.costs.elec_hot_water;
      detailSheet.getCell(row, 13).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 14).value = unit.costs.elec_cold_water;
      detailSheet.getCell(row, 14).numFmt = '€#,##0.00';

      // Totale
      detailSheet.getCell(row, 15).value = unit.costs.total;
      detailSheet.getCell(row, 15).numFmt = '€#,##0.00';
      detailSheet.getCell(row, 15).font = { bold: true };

      row++;
    });

    // Totali
    const totalRow = row;
    detailSheet.getCell(totalRow, 1).value = 'TOTALE';
    detailSheet.getCell(totalRow, 1).font = { bold: true };

    for (let col = 6; col <= 15; col++) {
      const colLetter = String.fromCharCode(64 + col);
      detailSheet.getCell(totalRow, col).value = {
        formula: `SUM(${colLetter}2:${colLetter}${totalRow - 1})`
      };
      detailSheet.getCell(totalRow, col).numFmt = '€#,##0.00';
      detailSheet.getCell(totalRow, col).font = { bold: true };
    }

    // Auto-width columns
    detailSheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: false }, cell => {
        const cellValue = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = Math.min(maxLength + 2, 30);
    });

    // Foglio letture contabilizzatori
    const readingsSheet = workbook.addWorksheet('Letture Contabilizzatori');

    const readingsHeaders = ['Unità', 'Contabilizzatore', 'Tipo', 'Lettura Iniziale', 'Data Inizio', 'Lettura Finale', 'Data Fine', 'Consumo'];
    readingsHeaders.forEach((header, idx) => {
      const cell = readingsSheet.getCell(1, idx + 1);
      cell.value = header;
      cell.style = headerStyle;
    });

    row = 2;
    data.units.forEach(unit => {
      if (unit.readings && unit.readings.length > 0) {
        unit.readings.forEach(reading => {
          readingsSheet.getCell(row, 1).value = unit.unit_number;
          readingsSheet.getCell(row, 2).value = reading.meter_code;
          readingsSheet.getCell(row, 3).value = reading.meter_type;
          readingsSheet.getCell(row, 4).value = reading.start_value;
          readingsSheet.getCell(row, 5).value = reading.start_date;
          readingsSheet.getCell(row, 6).value = reading.end_value;
          readingsSheet.getCell(row, 7).value = reading.end_date;
          readingsSheet.getCell(row, 8).value = reading.consumption;
          row++;
        });
      }
    });

    // Auto-width columns
    readingsSheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: false }, cell => {
        const cellValue = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, cellValue.length);
      });
      column.width = Math.min(maxLength + 2, 30);
    });

    // Invia il file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${dateFrom}_${dateTo}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Errore export Excel:', error);
    res.status(500).json({
      error: 'Errore durante l\'export Excel',
      details: error.message
    });
  }
};
