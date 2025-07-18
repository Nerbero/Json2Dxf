// dxf.worker.js

/**
 * Applica le trasformazioni (scala, rotazione, traslazione) a un vertice.
 * Assume l'ordine di Eulero XYZ per la rotazione, come Three.js di default.
 * @param {Array<number>} vertex - Il vertice [x, y, z].
 * @param {object} position - L'oggetto posizione {x, y, z}.
 * @param {object} rotation - L'oggetto rotazione (angoli di Eulero in radianti) {x, y, z}.
 * @param {object} scale - L'oggetto scala {x, y, z}.
 * @param {number} precision - La precisione per l'arrotondamento.
 * @param {boolean} force2D - Se forzare la coordinata Z a 0.
 * @returns {Array<number>} Il vertice trasformato.
 */
function applyTransformations(vertex, position, rotation, scale, precision, force2D) {
    let x = vertex[0];
    let y = vertex[1];
    let z = vertex[2];

    // 1. Applica scala
    x *= (scale.x !== undefined ? scale.x : 1);
    y *= (scale.y !== undefined ? scale.y : 1);
    z *= (scale.z !== undefined ? scale.z : 1);

    // 2. Applica rotazioni (ordine XYZ di Eulero)
    // Rotazione attorno all'asse X
    if (rotation.x !== undefined && rotation.x !== 0) {
        const cosX = Math.cos(rotation.x);
        const sinX = Math.sin(rotation.x);
        const ty = y * cosX - z * sinX;
        const tz = y * sinX + z * cosX;
        y = ty;
        z = tz;
    }
    // Rotazione attorno all'asse Y
    if (rotation.y !== undefined && rotation.y !== 0) {
        const cosY = Math.cos(rotation.y);
        const sinY = Math.sin(rotation.y);
        const tx = x * cosY + z * sinY;
        const tz = -x * sinY + z * cosY;
        x = tx;
        z = tz;
    }
    // Rotazione attorno all'asse Z
    if (rotation.z !== undefined && rotation.z !== 0) {
        const cosZ = Math.cos(rotation.z);
        const sinZ = Math.sin(rotation.z);
        const tx = x * cosZ - y * sinZ;
        const ty = x * sinZ + y * cosZ;
        x = tx;
        y = ty;
    }

    // 3. Applica traslazione
    x += (position.x !== undefined ? position.x : 0);
    y += (position.y !== undefined ? position.y : 0);
    z += (position.z !== undefined ? position.z : 0);

    // Applica force2D e precisione finale
    return [
        +x.toFixed(precision),
        +y.toFixed(precision),
        force2D ? 0 : +z.toFixed(precision)
    ];
}

/**
 * Estrae le entità geometriche (vertici, facce, linee, punti, cerchi, archi) dal JSON di Three.js.
 * Questa funzione cerca di interpretare la struttura di una BufferGeometry e il grafo della scena,
 * applicando le trasformazioni di posizione, rotazione e scala degli oggetti.
 * Se non viene trovata alcuna geometria Three.js valida, genera entità di esempio miste.
 * @param {object} json - Il JSON del modello Three.js.
 * @param {object} strategy - La strategia di conversione (precisione, forzatura 2D).
 * @param {object} advancedOptions - Opzioni avanzate (precisione, force2D, defaultLayer).
 * @param {AbortSignal} signal - Segnale per annullare l'operazione.
 * @returns {Promise<Array<object>>} Un array di entità DXF (LINE, 3DFACE, CIRCLE, ARC, POINT).
 */
async function extractEntitiesOptimized(json, strategy, advancedOptions, signal) {
    const entities = [];
    const precision = advancedOptions.precision;
    const force2D = advancedOptions.force2D;
    const defaultLayer = advancedOptions.defaultLayer;

    // Funzione helper per elaborare una singola geometria
    const processGeometry = (geometryData, objectTransform = {position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0}, scale: {x:1,y:1,z:1}}) => {
        if (signal && signal.aborted) throw new Error('Operazione annullata');

        const positions = geometryData.attributes?.position?.array;
        const indices = geometryData.index?.array;

        if (!positions) return; // Nessun dato di posizione, salta

        // Tentativo di rilevare geometrie primitive di Three.js
        if (geometryData.type === 'CircleGeometry' && geometryData.parameters) {
            const params = geometryData.parameters;
            const center = applyTransformations(
                [0, 0, 0], // Il centro di una CircleGeometry non trasformata è [0,0,0]
                objectTransform.position,
                objectTransform.rotation,
                objectTransform.scale,
                precision,
                force2D
            );
            entities.push({
                type: 'CIRCLE',
                center: center,
                radius: +(params.radius * objectTransform.scale.x).toFixed(precision), // Il raggio è scalato
                layer: defaultLayer // Usa layer di default
            });
            return; 
        }
        // Potresti aggiungere qui la logica per altre primitive come BoxGeometry, SphereGeometry, ecc.
        // che potrebbero essere convertite in entità SOLID o 3DFACE più strutturate.

        // Se abbiamo indici, creiamo 3DFACE (triangoli)
        if (indices && indices.length > 0) {
            for (let i = 0; i < indices.length; i += 3) {
                if (signal && signal.aborted) throw new Error('Operazione annullata');

                const idx1 = indices[i] * 3;
                const idx2 = indices[i + 1] * 3;
                const idx3 = indices[i + 2] * 3;

                if (idx1 + 2 < positions.length && idx2 + 2 < positions.length && idx3 + 2 < positions.length) {
                    const p1 = applyTransformations([positions[idx1], positions[idx1 + 1], positions[idx1 + 2]], objectTransform.position, objectTransform.rotation, objectTransform.scale, precision, force2D);
                    const p2 = applyTransformations([positions[idx2], positions[idx2 + 1], positions[idx2 + 2]], objectTransform.position, objectTransform.rotation, objectTransform.scale, precision, force2D);
                    const p3 = applyTransformations([positions[idx3], positions[idx3 + 1], positions[idx3 + 2]], objectTransform.position, objectTransform.rotation, objectTransform.scale, precision, force2D);

                    entities.push({
                        type: '3DFACE',
                        points: [
                            p1[0], p1[1], p1[2],
                            p2[0], p2[1], p2[2],
                            p3[0], p3[1], p3[2],
                            p3[0], p3[1], p3[2] // Il quarto punto è duplicato per i triangoli
                        ],
                        layer: defaultLayer // Usa layer di default
                    });
                }
            }
        } 
        // Se non ci sono indici ma ci sono posizioni, creiamo LINE (collegando punti consecutivi)
        else {
            for (let i = 0; i < positions.length - 5; i += 6) { // Prendiamo coppie di punti (x,y,z)
                if (signal && signal.aborted) throw new Error('Operazione annullata');

                const p1 = applyTransformations([positions[i], positions[i+1], positions[i+2]], objectTransform.position, objectTransform.rotation, objectTransform.scale, precision, force2D);
                const p2 = applyTransformations([positions[i+3], positions[i+4], positions[i+5]], objectTransform.position, objectTransform.rotation, objectTransform.scale, precision, force2D);
                
                entities.push({
                    type: 'LINE',
                    points: [
                        p1[0], p1[1], p1[2],
                        p2[0], p2[1], p2[2]
                    ],
                    layer: defaultLayer // Usa layer di default
                });
            }
        }
    };

    // Processa gli oggetti nel grafo della scena (Mesh, LineSegments, Points, Group)
    if (json.object && json.object.children && Array.isArray(json.object.children)) {
        const traverseObjects = (children, parentTransform = {position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0}, scale: {x:1,y:1,z:1}}) => {
            for (const child of children) {
                if (signal && signal.aborted) throw new Error('Operazione annullata');

                // Combina le trasformazioni del genitore con quelle del figlio
                const currentPosition = {
                    x: (parentTransform.position.x || 0) + (child.position?.x || 0),
                    y: (parentTransform.position.y || 0) + (child.position?.y || 0),
                    z: (parentTransform.position.z || 0) + (child.position?.z || 0)
                };
                const currentRotation = {
                    x: (parentTransform.rotation.x || 0) + (child.rotation?.x || 0),
                    y: (parentTransform.rotation.y || 0) + (child.rotation?.y || 0),
                    z: (parentTransform.rotation.z || 0) + (child.rotation?.z || 0)
                };
                const currentScale = {
                    x: (parentTransform.scale.x || 1) * (child.scale?.x || 1),
                    y: (parentTransform.scale.y || 1) * (child.scale?.y || 1),
                    z: (parentTransform.scale.z || 1) * (child.scale?.z || 1)
                };

                const currentTransform = {
                    position: currentPosition,
                    rotation: currentRotation,
                    scale: currentScale
                };

                if (child.geometry && json.geometries) {
                    // Trova la geometria corrispondente per UUID
                    const geomData = json.geometries.find(g => g.uuid === child.geometry);
                    if (geomData && geomData.data) {
                        // Se è un Mesh, elabora come facce/linee
                        if (child.type === 'Mesh') {
                            processGeometry(geomData.data, currentTransform);
                        }
                        // Se è LineSegments, elabora come linee
                        else if (child.type === 'LineSegments') {
                            const positions = geomData.data.attributes?.position?.array;
                            if (positions) {
                                for (let i = 0; i < positions.length - 5; i += 6) { // Linee sono coppie di punti
                                    if (signal && signal.aborted) throw new Error('Operazione annullata');

                                    const p1 = applyTransformations([positions[i], positions[i+1], positions[i+2]], currentTransform.position, currentTransform.rotation, currentTransform.scale, precision, force2D);
                                    const p2 = applyTransformations([positions[i+3], positions[i+4], positions[i+5]], currentTransform.position, currentTransform.rotation, currentTransform.scale, precision, force2D);
                                    
                                    entities.push({
                                        type: 'LINE',
                                        points: [
                                            p1[0], p1[1], p1[2],
                                            p2[0], p2[1], p2[2]
                                        ],
                                        layer: defaultLayer // Usa layer di default
                                    });
                                }
                            }
                        }
                        // Se è Points, elabora come punti
                        else if (child.type === 'Points') {
                            const positions = geomData.data.attributes?.position?.array;
                            if (positions) {
                                for (let i = 0; i < positions.length - 2; i += 3) { // Punti individuali (x,y,z)
                                    if (signal && signal.aborted) throw new Error('Operazione annullata');

                                    const p = applyTransformations([positions[i], positions[i+1], positions[i+2]], currentTransform.position, currentTransform.rotation, currentTransform.scale, precision, force2D);
                                    entities.push({
                                        type: 'POINT',
                                        point: [
                                            p[0], p[1], p[2]
                                        ],
                                        layer: defaultLayer // Usa layer di default
                                    });
                                }
                            }
                        }
                    }
                }

                // Se l'oggetto ha figli, attraversa ricorsivamente
                if (child.children && Array.isArray(child.children)) {
                    traverseObjects(child.children, currentTransform);
                }
            }
        };

        traverseObjects(json.object.children || [], {position: {x:0,y:0,z:0}, rotation: {x:0,y:0,z:0}, scale: {x:1,y:1,z:1}}); // Start traversal from the scene root
    }

    // Se non è stata trovata alcuna geometria valida o oggetti scena, genera entità di esempio
    if (entities.length === 0) {
        console.warn("Nessuna geometria Three.js valida o oggetti scena trovati nel JSON. Generazione di entità di esempio miste.");
        const numEntities = Math.min(500, Math.floor(1000 * (1 - strategy.simplify)));
        for (let i = 0; i < numEntities; i++) {
            if (signal && signal.aborted) throw new Error('Operazione annullata');

            const type = Math.floor(Math.random() * 5); // 0: LINE, 1: 3DFACE, 2: CIRCLE, 3: ARC, 4: POINT
            const layer = defaultLayer; 
            
            if (type === 0) { // LINE
                entities.push({
                    type: 'LINE',
                    points: [
                        +(Math.random() * 100).toFixed(precision), +(Math.random() * 100).toFixed(precision), force2D ? 0 : +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision), +(Math.random() * 100).toFixed(precision), force2D ? 0 : +(Math.random() * 100).toFixed(precision)
                    ],
                    layer: layer
                });
            } else if (type === 1) { // 3DFACE
                entities.push({
                    type: '3DFACE',
                    points: [
                        +(Math.random() * 100).toFixed(precision), +(Math.random() * 100).toFixed(precision), force2D ? 0 : +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision), +(Math.random() * 100).toFixed(precision), force2D ? 0 : +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision), +(Math.random() * 100).toFixed(precision), force2D ? 0 : +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision), +(Math.random() * 100).toFixed(precision), force2D ? 0 : +(Math.random() * 100).toFixed(precision)
                    ],
                    layer: layer
                });
            } else if (type === 2) { // CIRCLE
                entities.push({
                    type: 'CIRCLE',
                    center: [
                        +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision),
                        force2D ? 0 : +(Math.random() * 100).toFixed(precision)
                    ],
                    radius: +(1 + Math.random() * 10).toFixed(precision),
                    layer: layer
                });
            } else if (type === 3) { // ARC
                const startAngle = +(Math.random() * 360).toFixed(precision);
                const endAngle = +(startAngle + (Math.random() * 180 + 30)).toFixed(precision); // Arc at least 30 degrees
                entities.push({
                    type: 'ARC',
                    center: [
                        +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision),
                        force2D ? 0 : +(Math.random() * 100).toFixed(precision)
                    ],
                    radius: +(1 + Math.random() * 10).toFixed(precision),
                    startAngle: startAngle,
                    endAngle: endAngle,
                    layer: layer
                });
            } else if (type === 4) { // POINT
                entities.push({
                    type: 'POINT',
                    point: [
                        +(Math.random() * 100).toFixed(precision),
                        +(Math.random() * 100).toFixed(precision),
                        force2D ? 0 : +(Math.random() * 100).toFixed(precision)
                    ],
                    layer: layer
                });
            }
        }
    }
    
    // Simulate an asynchronous operation
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000)); 
    return entities;
}

/**
 * Genera il contenuto DXF basandosi sulle entità estratte e la strategia.
 * @param {Array<object>} entities - Un array di entità DXF da scrivere.
 * @param {object} strategy - La strategia di conversione.
 * @returns {string} Il contenuto del file DXF.
 */
function generateDXFWithOptions(entities, strategy) {
    let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\n${strategy.format}\n0\nENDSEC\n`;
    
    if (strategy.format !== 'R12') {
        dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n`;
        // Genera layer dinamici se non è R12
        const uniqueLayers = [...new Set(entities.map(e => e.layer))].sort((a, b) => a - b);
        uniqueLayers.forEach((layer, index) => {
            dxf += `0\nLAYER\n2\n${layer}\n70\n0\n62\n${(index * 7 + 1) % 256}\n`; // Colore casuale
        });
        dxf += `0\nENDTAB\n0\nENDSEC\n`;
    }
    
    dxf += `0\nSECTION\n2\nENTITIES\n`;
    
    entities.forEach(entity => {
        dxf += `0\n${entity.type}\n8\n${entity.layer}\n`;
        
        if (entity.type === 'LINE') {
            // LINE ha due punti (Start, End)
            dxf += `10\n${entity.points[0]}\n20\n${entity.points[1]}\n30\n${entity.points[2]}\n`; // Start X, Y, Z
            dxf += `11\n${entity.points[3]}\n21\n${entity.points[4]}\n31\n${entity.points[5]}\n`; // End X, Y, Z
        } else if (entity.type === '3DFACE') {
            // 3DFACE ha quattro punti (anche per triangoli, il 4° è duplicato del 3°)
            dxf += `10\n${entity.points[0]}\n20\n${entity.points[1]}\n30\n${entity.points[2]}\n`; // Punto 1 X, Y, Z
            dxf += `11\n${entity.points[3]}\n21\n${entity.points[4]}\n31\n${entity.points[5]}\n`; // Punto 2 X, Y, Z
            dxf += `12\n${entity.points[6]}\n22\n${entity.points[7]}\n32\n${entity.points[8]}\n`; // Punto 3 X, Y, Z
            dxf += `13\n${entity.points[9]}\n23\n${entity.points[10]}\n33\n${entity.points[11]}\n`; // Punto 4 X, Y, Z
        } else if (entity.type === 'CIRCLE') {
            // CIRCLE ha centro (10, 20, 30) e raggio (40)
            dxf += `10\n${entity.center[0]}\n20\n${entity.center[1]}\n30\n${entity.center[2]}\n`; // Centro X, Y, Z
            dxf += `40\n${entity.radius}\n`; // Raggio
        } else if (entity.type === 'ARC') {
            // ARC ha centro (10, 20, 30), raggio (40), angolo iniziale (50), angolo finale (51)
            dxf += `10\n${entity.center[0]}\n20\n${entity.center[1]}\n30\n${entity.center[2]}\n`; // Centro X, Y, Z
            dxf += `40\n${entity.radius}\n`; // Raggio
            dxf += `50\n${entity.startAngle}\n`; // Angolo iniziale
            dxf += `51\n${entity.endAngle}\n`; // Angolo finale
        } else if (entity.type === 'POINT') {
            // POINT ha un singolo punto (10, 20, 30)
            dxf += `10\n${entity.point[0]}\n20\n${entity.point[1]}\n30\n${entity.point[2]}\n`; // Punto X, Y, Z
        }
        // Altri tipi di entità DXF possono essere aggiunti qui (es. POLYLINE, TEXT, INSERT, ecc.)
    });
    
    dxf += `0\nENDSEC\n0\nEOF`;
    return dxf;
}

// Listener per i messaggi dal thread principale
self.onmessage = async function(event) {
    const { type, json, strategy, advancedOptions, signal } = event.data;

    if (type === 'convert') {
        try {
            // Aggiungi un listener per l'evento abort
            if (signal) {
                signal.onabort = () => {
                    self.postMessage({ type: 'conversionCancelled' });
                };
            }

            const entities = await extractEntitiesOptimized(json, strategy, advancedOptions, signal);
            if (signal && signal.aborted) return; // Controlla di nuovo dopo extractEntitiesOptimized

            const dxfContent = generateDXFWithOptions(entities, strategy);
            self.postMessage({ type: 'conversionComplete', data: { dxfContent } });
        } catch (error) {
            if (error.message === 'Operazione annullata') {
                 self.postMessage({ type: 'conversionCancelled' });
            } else {
                 self.postMessage({ type: 'conversionError', error: { message: error.message } });
            }
        }
    }
};
