// app.js
// Punto di ingresso principale dell'applicazione.
// Inizializza i moduli e gestisce il flusso generale.

import { UIHandler } from './uiHandler.js';
import { ThreeJSParser } from './threeJSParser.js';
import { DXFGenerator } from './dxfGenerator.js';

document.addEventListener('DOMContentLoaded', () => {
    const ui = new UIHandler();
    const threeJSParser = new ThreeJSParser();
    const dxfGenerator = new DXFGenerator();

    let jsonData = null;
    let conversionWorker = null;
    let abortController = null; // Per annullare la conversione

    // Inizializza il Web Worker per la conversione DXF
    if (window.Worker) {
        conversionWorker = new Worker('dxf.worker.js');
        conversionWorker.onmessage = handleWorkerMessage;
        conversionWorker.onerror = handleWorkerError;
    } else {
        ui.updateStatus('Errore: I Web Workers non sono supportati dal tuo browser. La conversione potrebbe bloccare l\'interfaccia.', 'error');
    }

    // Gestione dei messaggi dal Web Worker
    function handleWorkerMessage(event) {
        const { type, data, error } = event.data;

        if (type === 'conversionComplete') {
            ui.downloadFile(data.dxfContent, `export_${ui.getExportMode()}.dxf`);
            ui.updateStatus('Conversione completata con successo!', 'success');
            ui.updateProgressBar(100);
            ui.setConvertButtonIcon('check');
            
            setTimeout(() => {
                ui.resetUIState();
            }, 3000);
        } else if (type === 'conversionError') {
            ui.updateStatus(`Errore di conversione: ${error.message}`, 'error');
            ui.updateProgressBar(0);
            ui.setConvertButtonIcon('times');
            ui.showResetButton();
            ui.enableInfoButton();
            ui.enableExportStlButton();
            ui.hideCancelButton();
        } else if (type === 'conversionCancelled') {
            ui.updateStatus('Conversione annullata.', 'error');
            ui.updateProgressBar(0);
            ui.setConvertButtonIcon('sync'); // Ripristina icona
            ui.showResetButton();
            ui.enableInfoButton();
            ui.enableExportStlButton();
            ui.hideCancelButton();
        }
    }

    // Gestione degli errori dal Web Worker
    function handleWorkerError(event) {
        ui.updateStatus(`Errore nel worker: ${event.message}`, 'error');
        ui.updateProgressBar(0);
        ui.setConvertButtonIcon('times');
        ui.showResetButton();
        ui.enableInfoButton();
        ui.enableExportStlButton();
        ui.hideCancelButton();
    }

    // Event Listener per il caricamento del file
    ui.onFileSelected(async (file) => {
        ui.resetUIState();
        ui.updateStatus('Lettura file in corso...');
        ui.updateProgressBar(30);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                jsonData = JSON.parse(e.target.result);
                
                // Validazione JSON più specifica
                const hasMetadata = !!jsonData.metadata;
                const hasGeometries = jsonData.geometries && Array.isArray(jsonData.geometries) && jsonData.geometries.length > 0;
                const hasObjectChildren = jsonData.object && jsonData.object.children && Array.isArray(jsonData.object.children) && jsonData.object.children.length > 0;

                if (!hasMetadata && !hasGeometries && !hasObjectChildren) {
                    throw new Error("Il file JSON non sembra contenere una struttura Three.js valida (mancano 'metadata', 'geometries' o 'object.children').");
                }
                if (!hasGeometries && !hasObjectChildren) {
                     throw new Error("Nessuna geometria rilevata nel file JSON. Assicurati che contenga dati geometrici.");
                }

                ui.updateStatus(`File caricato: ${file.name}`, 'success');
                ui.updateStatusExtra(`<br><small style="opacity:0.7">${ui.formatFileSize(file.size)}</small>`);
                ui.enableConvertButton();
                ui.enableExportStlButton();
                ui.updateProgressBar(50);
                ui.setConvertButtonPulse(true);
                ui.hideResetButton();

                // Carica il modello in Three.js per l'anteprima
                ui.loadModelIntoThreeJS(jsonData);

            } catch (error) {
                ui.updateStatus(`Errore: ${error.message}`, 'error');
                ui.updateProgressBar(0);
                jsonData = null;
                ui.disableConvertButton();
                ui.disableExportStlButton();
                ui.setConvertButtonPulse(false);
                ui.showResetButton();
                ui.hidePreview();
            }
        };
        reader.onerror = () => {
            ui.updateStatus('Errore nella lettura del file.', 'error');
            ui.updateProgressBar(0);
            jsonData = null;
            ui.disableConvertButton();
            ui.disableExportStlButton();
            ui.setConvertButtonPulse(false);
            ui.showResetButton();
            ui.hidePreview();
        };
        reader.readAsText(file);
    });

    // Event Listener per il pulsante Converti DXF
    ui.onConvertDxf(() => {
        if (!jsonData) return;

        ui.updateStatus('Conversione in corso...');
        ui.updateProgressBar(70);
        ui.disableConvertButton();
        ui.disableExportStlButton();
        ui.setConvertButtonPulse(false);
        ui.setConvertButtonIcon('spinner');
        ui.hideResetButton();
        ui.showCancelButton();
        ui.disableInfoButton();

        abortController = new AbortController(); // Inizializza AbortController

        const strategy = ui.getConversionStrategy();
        const advancedOptions = ui.getAdvancedOptions();

        // Invia i dati al worker
        conversionWorker.postMessage({
            type: 'convert',
            json: jsonData,
            strategy: strategy,
            advancedOptions: advancedOptions,
            signal: abortController.signal // Passa il segnale di abort
        });
    });

    // Event Listener per il pulsante Annulla
    ui.onCancelConversion(() => {
        if (abortController) {
            abortController.abort(); // Segnala al worker di annullare
            ui.updateStatus('Annullamento in corso...', 'error');
            ui.disableCancelButton();
        }
    });

    // Event Listener per il pulsante Esporta STL
    ui.onExportStl(() => {
        if (!ui.getCurrentModelMesh()) {
            ui.updateStatus('Nessun modello caricato per l\'esportazione STL.', 'error');
            return;
        }

        ui.updateStatus('Esportazione STL in corso...');
        ui.disableExportStlButton();
        ui.disableConvertButton();
        ui.disableInfoButton();

        try {
            const exporter = new THREE.STLExporter();
            const result = exporter.parse(ui.getCurrentModelMesh()); 
            
            ui.downloadFile(result, 'model.stl', 'application/octet-stream');
            
            setTimeout(() => {
                ui.updateStatus('Esportazione STL completata!', 'success');
                ui.enableExportStlButton();
                ui.enableConvertButton();
                ui.enableInfoButton();
            }, 100);

        } catch (error) {
            ui.updateStatus(`Errore esportazione STL: ${error.message}`, 'error');
            ui.enableExportStlButton();
            ui.enableConvertButton();
            ui.enableInfoButton();
        }
    });

    // Event Listener per il pulsante Reset
    ui.onReset(() => {
        ui.resetUIState();
    });
});
