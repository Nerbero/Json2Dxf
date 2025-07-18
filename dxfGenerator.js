// dxfGenerator.js
// Contiene la logica per la generazione del contenuto DXF.

export class DXFGenerator {
    /**
     * Genera il contenuto DXF basandosi sulle entità estratte e la strategia.
     * @param {Array<object>} entities - Un array di entità DXF da scrivere.
     * @param {object} strategy - La strategia di conversione.
     * @returns {string} Il contenuto del file DXF.
     */
    generateDXFWithOptions(entities, strategy) {
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
}
