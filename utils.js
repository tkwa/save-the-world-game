// Utility functions for the AI Timeline Game

function formatSignificantFigures(num, sigFigs) {
    if (num === 0) return '0';
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const precision = sigFigs - 1 - magnitude;
    return num.toFixed(Math.max(0, precision));
}

function getAlignmentText(level) {
    if (level >= 0.857) return 'Very Aligned';
    if (level >= 0.714) return 'Aligned';
    if (level >= 0.571) return 'Slightly Aligned';
    if (level >= 0.429) return 'Neutral';
    if (level >= 0.286) return 'Slightly Misaligned';
    if (level >= 0.143) return 'Misaligned';
    return 'Very Misaligned';
}

function getAlignmentKey(level) {
    if (level >= 0.857) return 'very_aligned';
    if (level >= 0.714) return 'aligned';
    if (level >= 0.571) return 'slightly_aligned';
    if (level >= 0.429) return 'neutral';
    if (level >= 0.286) return 'slightly_misaligned';
    if (level >= 0.143) return 'misaligned';
    return 'very_misaligned';
}

function getCapabilityRange(capability) {
    if (capability < 4) return '<4x';
    if (capability <= 10) return '5-10x';
    return '>10x';
}

async function loadEndTexts() {
    try {
        const response = await fetch('end_texts.json');
        return await response.json();
    } catch (error) {
        console.error('Failed to load end texts:', error);
        return {
            end_text: {
                very_aligned: 'Humanity colonizes the stars and you make a billion billion billion dollars',
                aligned: 'Humanity colonizes the stars and you make a billion billion billion dollars',
                slightly_aligned: 'Robots colonize the stars and humanity dies out in the year 5108',
                neutral: 'Robots colonize the stars and humanity dies out in the year 5108',
                slightly_misaligned: 'Robots colonize the stars and humanity dies out in the year 5108',
                misaligned: 'Humanity is eaten by nanobots',
                very_misaligned: 'Humanity is eaten by nanobots'
            }
        };
    }
}