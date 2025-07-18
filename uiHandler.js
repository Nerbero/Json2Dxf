// uiHandler.js
// Gestisce tutte le interazioni con l'interfaccia utente e l'integrazione con Three.js.

export class UIHandler {
    constructor() {
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.convertBtn = document.getElementById('convertBtn');
        this.convertBtnIcon = document.getElementById('convertBtnIcon');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.exportStlBtn = document.getElementById('exportStlBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.infoBtn = document.getElementById('infoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.infoModalClose = document.getElementById('infoModalClose');
        this.statusEl = document.getElementById('status');
        this.progressBar = document.getElementById('progressBar');
        this.exportModeSelect = document.getElementById('exportMode');
        this.modeDescriptionEl = document.getElementById('modeDescription');
        this.previewContainer = document.getElementById('previewContainer');
        this.threejsCanvas = document.getElementById('threejsCanvas');
        this.previewToggleBtn = document.getElementById('previewToggleBtn');

        // Advanced Options DOM
        this.advancedOptionsPanel = document.getElementById('advancedOptionsPanel');
        this.advancedOptionsToggle = document.getElementById('advancedOptionsToggle');
        this.precisionSlider = document.getElementById('precisionSlider');
        this.precisionValueSpan = document.getElementById('precisionValue');
        this.force2DToggle = document.getElementById('force2DToggle');
        this.defaultLayerInput = document.getElementById('defaultLayerInput');

        this.threejsScene = null;
        this.threejsCamera = null;
        this.threejsRenderer = null;
        this.currentModelMesh = null; // Riferimento al modello Three.js caricato

        this.modeDescriptions = {
            balanced: `<strong>⚖️ Bilanciato:</strong> Miglior compromesso tra qualità e performance. Ideale per la maggior parte dei casi.`,
            highQuality: `<strong>🎯 Alta Qualità:</strong> Mantiene tutti i dettagli con tolleranza 0.01mm. Consigliato per:<br>
                         - Stampa 3D professionale<br>
                         - Macchinari CNC<br>
                         - Dispositivi con GPU dedicata`,
            performance: `<strong>🚀 Massima Performance:</strong> Ottimizzato per scene complesse (>50k vertici). Caratteristiche:<br>
                         - Semplificazione geometria aggressiva<br>
                         - Web Workers multithread<br>
                         - Precisione ridotta a 0.1mm`,
            mobile: `<strong>📱 Ottimizzato Mobile:</strong> Per dispositivi entry-level. Include:<br>
                    - Riduzione memoria del 60%<br>
                    - Disabilitazione effetti avanzati<br>
                    - Cache persistente con IndexedDB`,
            legacy: `<strong>🕰️ Compatibilità Legacy:</strong> Per software CAD obsoleti. Supporta:<br>
                    - DXF R12 (ASCII)<br>
                    - Solo layer 0<br>
                    - Nessun 3D`
        };

        this.initEventListeners();
        this.initThreeJS();
        this.resetUIState();
    }

    initEventListeners() {
        // Drag & drop
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        ['dragenter', 'dragover'].forEach(event => {
            this.dropZone.addEventListener(event, (e) => {
                e.preventDefault();
                this.dropZone.classList.add('active');
            });
        });
        ['dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, (e) => { 
                e.preventDefault();
                this.dropZone.classList.remove('active');
            });
        });

        // File input change is handled by app.js
        
        // Mode change
        this.exportModeSelect.addEventListener('change', () => {
            this.modeDescriptionEl.innerHTML = this.modeDescriptions[this.exportModeSelect.value];
        });

        // Advanced options panel toggle
        this.advancedOptionsToggle.addEventListener('click', () => {
            this.advancedOptionsPanel.classList.toggle('expanded');
        });

        // Precision slider update
        this.precisionSlider.addEventListener('input', (e) => {
            this.precisionValueSpan.textContent = e.target.value;
        });

        // Info modal
        this.infoBtn.addEventListener('click', () => {
            this.infoModal.classList.add('show');
        });
        this.infoModalClose.addEventListener('click', () => {
            this.infoModal.classList.remove('show');
        });
        this.infoModal.addEventListener('click', (e) => {
            if (e.target === this.infoModal) {
                this.infoModal.classList.remove('show');
            }
        });

        // Preview toggle
        this.previewToggleBtn.addEventListener('click', () => {
            const isShowing = this.previewContainer.classList.contains('show');
            if (isShowing) {
                this.hidePreview();
            } else {
                this.showPreview();
            }
        });
    }

    // --- UI State Management ---
    resetUIState() {
        this.fileInput.value = '';
        this.disableConvertButton();
        this.disableExportStlButton();
        this.setConvertButtonPulse(false);
        this.setConvertButtonIcon('sync');
        this.updateStatus('Pronto per la conversione');
        this.updateProgressBar(0);
        this.hideResetButton();
        this.hideCancelButton();
        this.enableInfoButton();
        this.dropZone.classList.remove('active');
        this.clearThreeJSScene();
        this.hidePreview();
    }

    updateStatus(message, type = '') {
        this.statusEl.textContent = message;
        this.statusEl.className = 'status'; // Reset classes
        if (type) {
            this.statusEl.classList.add(type);
        }
    }

    updateStatusExtra(htmlContent) {
        this.statusEl.innerHTML += htmlContent;
    }

    updateProgressBar(width) {
        this.progressBar.style.width = `${width}%`;
    }

    enableConvertButton() {
        this.convertBtn.disabled = false;
    }

    disableConvertButton() {
        this.convertBtn.disabled = true;
    }

    enableExportStlButton() {
        this.exportStlBtn.style.display = 'block';
        this.exportStlBtn.disabled = false;
    }

    disableExportStlButton() {
        this.exportStlBtn.disabled = true;
    }

    setConvertButtonPulse(active) {
        if (active) {
            this.convertBtn.classList.add('pulse');
        } else {
            this.convertBtn.classList.remove('pulse');
        }
    }

    setConvertButtonIcon(iconName) {
        this.convertBtnIcon.innerHTML = `<i class="fas fa-${iconName}"></i>`;
    }

    showResetButton() {
        this.resetBtn.style.display = 'block';
    }

    hideResetButton() {
        this.resetBtn.style.display = 'none';
    }

    showCancelButton() {
        this.cancelBtn.style.display = 'block';
        this.cancelBtn.disabled = false;
    }

    hideCancelButton() {
        this.cancelBtn.style.display = 'none';
    }

    enableInfoButton() {
        this.infoBtn.disabled = false;
    }

    disableInfoButton() {
        this.infoBtn.disabled = true;
    }

    showPreview() {
        this.previewContainer.classList.add('show');
        this.previewToggleBtn.textContent = 'Nascondi Anteprima 3D';
        // Ensure renderer is resized correctly if visibility changes
        if (this.threejsRenderer && this.threejsCamera) {
            this.threejsRenderer.setSize(this.threejsCanvas.clientWidth, this.threejsCanvas.clientHeight);
            this.threejsCamera.aspect = this.threejsCanvas.clientWidth / this.threejsCanvas.clientHeight;
            this.threejsCamera.updateProjectionMatrix();
        }
    }

    hidePreview() {
        this.previewContainer.classList.remove('show');
        this.previewToggleBtn.textContent = 'Mostra Anteprima 3D';
    }

    // --- Three.js Integration ---
    initThreeJS() {
        this.threejsScene = new THREE.Scene();
        this.threejsScene.background = new THREE.Color(0x282c34); // Dark background

        this.threejsCamera = new THREE.PerspectiveCamera(75, this.threejsCanvas.clientWidth / this.threejsCanvas.clientHeight, 0.1, 2000);
        this.threejsCamera.position.set(0, 0, 100);
        this.threejsCamera.lookAt(this.threejsScene.position);

        this.threejsRenderer = new THREE.WebGLRenderer({ canvas: this.threejsCanvas, antialias: true });
        this.threejsRenderer.setSize(this.threejsCanvas.clientWidth, this.threejsCanvas.clientHeight);
        this.threejsRenderer.setPixelRatio(window.devicePixelRatio);

        // Basic orbit controls (manual implementation for simplicity, no external OrbitControls.js)
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.threejsCanvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.threejsCanvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.threejsCanvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            // Rotate around Y axis for horizontal drag
            this.threejsScene.rotation.y += deltaX * 0.01;
            // Rotate around X axis for vertical drag
            this.threejsScene.rotation.x += deltaY * 0.01;

            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.threejsScene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1).normalize();
        this.threejsScene.add(directionalLight);

        const animate = () => {
            requestAnimationFrame(animate);
            this.threejsRenderer.render(this.threejsScene, this.threejsCamera);
        };
        animate();

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.threejsCanvas.parentElement.classList.contains('show')) { // Only resize if visible
                this.threejsCamera.aspect = this.threejsCanvas.clientWidth / this.threejsCanvas.clientHeight;
                this.threejsCamera.updateProjectionMatrix();
                this.threejsRenderer.setSize(this.threejsCanvas.clientWidth, this.threejsCanvas.clientHeight);
            }
        });
    }

    clearThreeJSScene() {
        if (this.threejsScene) {
            while (this.threejsScene.children.length > 0) {
                const obj = this.threejsScene.children[0];
                this.threejsScene.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            }
        }
        this.currentModelMesh = null;
        if (this.threejsCamera) {
            this.threejsCamera.position.set(0, 0, 100);
            this.threejsCamera.lookAt(0, 0, 0);
            this.threejsScene.rotation.set(0,0,0); // Reset scene rotation
        }
    }

    loadModelIntoThreeJS(json) {
        this.clearThreeJSScene(); // Clear scene before loading new model

        const loader = new THREE.ObjectLoader();
        try {
            const object = loader.parse(json);
            this.threejsScene.add(object);
            this.currentModelMesh = object; // Save reference to the loaded model

            // Center and fit camera to the model
            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Calculate a suitable distance for the camera
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.threejsCamera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.2; // Add some padding

            this.threejsCamera.position.copy(center);
            this.threejsCamera.position.z += cameraZ;
            this.threejsCamera.lookAt(center);
            
            this.showPreview(); // Show the preview container
        } catch (error) {
            console.error("Errore nel caricamento del modello Three.js:", error);
            this.updateStatus(`Errore visualizzazione 3D: ${error.message}`, 'error');
            this.hidePreview();
        }
    }

    getCurrentModelMesh() {
        return this.currentModelMesh;
    }

    // --- Helper Functions ---
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }

    downloadFile(content, filename, mimeType = 'application/dxf') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    getExportMode() {
        return this.exportModeSelect.value;
    }

    getConversionStrategy() {
        const mode = this.exportModeSelect.value;
        return {
            balanced: { simplify: 0.1, format: 'R2018', workers: true },
            highQuality: { simplify: 0.01, format: 'R2018', workers: false },
            performance: { simplify: 0.5, format: 'R2018', workers: true },
            mobile: { simplify: 0.2, format: 'R12', workers: false },
            legacy: { simplify: 1, format: 'R12', workers: false, force2D: true }
        }[mode];
    }

    getAdvancedOptions() {
        return {
            precision: parseInt(this.precisionSlider.value),
            force2D: this.force2DToggle.checked,
            defaultLayer: this.defaultLayerInput.value.trim() || '0'
        };
    }

    // --- Event Emitters for app.js ---
    onFileSelected(callback) {
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                callback(e.target.files[0]);
            }
        });
        this.dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) {
                callback(e.dataTransfer.files[0]);
            }
        });
    }

    onConvertDxf(callback) {
        this.convertBtn.addEventListener('click', callback);
    }

    onCancelConversion(callback) {
        this.cancelBtn.addEventListener('click', callback);
    }

    onExportStl(callback) {
        this.exportStlBtn.addEventListener('click', callback);
    }

    onReset(callback) {
        this.resetBtn.addEventListener('click', callback);
    }
}
