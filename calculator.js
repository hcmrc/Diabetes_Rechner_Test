/**
 * Diabetes Risk Calculator
 * Based on the diabetes prediction model (Schmidt et al. 2005, ARIC Study)
 * Enhanced UI: Diverging Bar Chart (Tornado Plot) with Mean Centering
 */

// ============================================
// 1. CONFIGURATION & CONSTANTS
// ============================================

const CONFIG = {
    // Model Coefficients (Betas) from Schmidt et al.
    BETAS: {
        age: 0.0173,
        race: 0.4433,       // Black (1) vs Other (0)
        parentHist: 0.4981, // Yes (1) vs No (0)
        sbp: 0.0111,
        waist: 0.0273,      // cm
        height: -0.0326,    // cm
        fastGlu: 1.5849,    // mmol/L
        cholHDL: -0.4718,   // mmol/L
        cholTri: 0.242,     // mmol/L
        sigma: -9.9808      // Intercept
    },

    // Population Means (ARIC Study Baseline)
    MEANS: {
        age: 54,
        race: 0.25,
        parentHist: 0.3,
        sbp: 120,
        waist: 97,
        height: 168,
        fastGlu: 5.5,
        cholHDL: 1.3,
        cholTri: 1.7
    },

    // Unit Conversions
    CONVERSIONS: {
        heightToCm: 2.54,
        waistToCm: 2.54,
        gluToMmol: 1 / 18,
        hdlToMmol: 1 / 38.67,
        triToMmol: 1 / 88.57
    },

    // Slider Limits [min, max, step]
    RANGES: {
        age: { us: [20, 80, 1], si: [20, 80, 1] },
        sbp: { us: [90, 200, 1], si: [90, 200, 1] },
        height: { us: [48, 84, 1], si: [122, 213, 1] },      // 48-84 in * 2.54
        waist: { us: [25, 60, 1], si: [64, 152, 1] },        // 25-60 in * 2.54
        fastGlu: { us: [50, 300, 1], si: [2.8, 16.7, 0.1] }, // 50-300 mg/dL / 18
        cholHDL: { us: [20, 100, 1], si: [0.5, 2.6, 0.1] },  // 20-100 mg/dL / 38.67
        cholTri: { us: [50, 500, 1], si: [0.6, 5.6, 0.1] }   // 50-500 mg/dL / 88.57
    },

    // Display Labels for the Chart
    LABELS: {
        age: 'Age',
        race: 'Race',
        parentHist: 'Parental Diabetes History',
        sbp: 'Blood Pressure',
        waist: 'Waist Size',
        height: 'Height',
        fastGlu: 'Glucose',
        cholHDL: 'Good Cholesterol (HDL)',
        cholTri: 'Triglycerides'
    },

    // Factor-specific treatment recommendations with scientific sources
    // Thresholds for elevated values (in SI units for internal calculations)
    THRESHOLDS: {
        fastGlu: { elevated: 5.6, high: 7.0 },      // mmol/L - ADA 2024 criteria
        sbp: { elevated: 130, high: 140 },           // mmHg - ACC/AHA 2017
        cholHDL: { low: 1.0, veryLow: 0.8 },         // mmol/L (inverse - low is bad)
        cholTri: { elevated: 1.7, high: 2.3 },       // mmol/L - AHA guidelines
        waist: { elevated: 94, high: 102 }           // cm - WHO criteria (male)
    },

    // Treatment recommendations for each factor
    TREATMENTS: {
        fastGlu: {
            id: 'glucose-treatment',
            icon: 'bloodtype',
            title: 'Glucose Management',
            therapies: [
                { name: 'Metformin', desc: 'First-line for elevated glucose (HbA1c ≥6.5%)' },
                { name: 'GLP-1 RA', desc: 'Semaglutide/Tirzepatide for glycemic control + weight loss' },
                { name: 'SGLT2i', desc: 'Empagliflozin reduces glucose via urinary excretion' }
            ]
        },
        sbp: {
            id: 'bp-treatment',
            icon: 'favorite',
            title: 'Blood Pressure Control',
            therapies: [
                { name: 'ACE-I/ARB', desc: 'First-line for diabetes + hypertension' },
                { name: 'DASH Diet', desc: 'Dietary Approaches to Stop Hypertension' },
                { name: 'Sodium Reduction', desc: 'Target <2300mg/day sodium intake' }
            ]
        },
        cholHDL: {
            id: 'hdl-treatment',
            icon: 'water_drop',
            title: 'HDL Cholesterol Improvement',
            therapies: [
                { name: 'Aerobic Exercise', desc: '150 min/week increases HDL 5-10%' },
                { name: 'Smoking Cessation', desc: 'Raises HDL by 5-10% within weeks' },
                { name: 'Omega-3 Fatty Acids', desc: 'EPA/DHA supplementation modestly raises HDL' }
            ]
        },
        cholTri: {
            id: 'tri-treatment',
            icon: 'science',
            title: 'Triglyceride Reduction',
            therapies: [
                { name: 'Icosapent Ethyl', desc: 'REDUCE-IT: 25% CV risk reduction' },
                { name: 'Weight Loss', desc: '5-10% loss reduces TG by 20%' },
                { name: 'Limit Refined Carbs', desc: 'Reduce sugar/alcohol to lower TG' }
            ]
        },
        waist: {
            id: 'waist-treatment',
            icon: 'straighten',
            title: 'Central Obesity Management',
            therapies: [
                { name: 'Tirzepatide', desc: '20% weight loss in SURMOUNT trials' },
                { name: 'Caloric Deficit', desc: '500-750 kcal/day deficit for weight loss' },
                { name: 'Bariatric Surgery', desc: 'Consider if BMI >35 with comorbidities' }
            ]
        }
    }
};

// State
let state = {
    useMetric: false
};

// ============================================
// 2. INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize slider fills
    ['age', 'sbp', 'height', 'waist', 'fastGlu', 'cholHDL', 'cholTri'].forEach(updateSliderFill);
    
    calculateRisk();
    const unitToggle = document.getElementById('unit-toggle');
    if (unitToggle) unitToggle.addEventListener('change', toggleUnits);
});

// ============================================
// 3. INPUT & UI HANDLING
// ============================================

window.toggleUnits = function() {
    const wasMetric = state.useMetric;
    state.useMetric = document.getElementById('unit-toggle').checked;
    
    // Only convert if the unit system actually changed
    if (wasMetric !== state.useMetric) {
        // FIRST: Save current values BEFORE changing ranges (to avoid browser clamping)
        const savedValues = {};
        const fields = ['height', 'waist', 'fastGlu', 'cholHDL', 'cholTri'];
        fields.forEach(field => {
            savedValues[field] = parseFloat(document.getElementById(`${field}-value`).value);
        });
        
        // Toggle label weights
        document.getElementById('unit-label-us').style.fontWeight = state.useMetric ? '400' : '700';
        document.getElementById('unit-label-si').style.fontWeight = state.useMetric ? '700' : '400';

        updateUnitLabels();
        
        // Update slider ranges
        updateSliderRangesOnly();
        
        // Convert and apply saved values
        convertSavedValues(savedValues);
        
        // Update all slider fills
        ['height', 'waist', 'fastGlu', 'cholHDL', 'cholTri', 'age', 'sbp'].forEach(updateSliderFill);
    }
    
    calculateRisk();
};

function convertSavedValues(savedValues) {
    const conv = CONFIG.CONVERSIONS;
    const mode = state.useMetric ? 'si' : 'us';
    
    Object.keys(savedValues).forEach(field => {
        const input = document.getElementById(`${field}-value`);
        const slider = document.getElementById(`${field}-slider`);
        let val = savedValues[field];
        
        // Convert the value based on the NEW unit system
        if (state.useMetric) {
            // Was US, now SI -> multiply to convert
            if (field === 'height' || field === 'waist') val *= conv.heightToCm;
            if (field === 'fastGlu') val *= conv.gluToMmol;
            if (field === 'cholHDL') val *= conv.hdlToMmol;
            if (field === 'cholTri') val *= conv.triToMmol;
        } else {
            // Was SI, now US -> divide to convert
            if (field === 'height' || field === 'waist') val /= conv.heightToCm;
            if (field === 'fastGlu') val /= conv.gluToMmol;
            if (field === 'cholHDL') val /= conv.hdlToMmol;
            if (field === 'cholTri') val /= conv.triToMmol;
        }
        
        // Get the range for clamping
        const range = CONFIG.RANGES[field][mode];
        const min = range[0];
        const max = range[1];
        const step = range[2];
        
        // Clamp to range
        if (val < min) val = min;
        if (val > max) val = max;
        
        // Round appropriately
        if (step < 1) {
            val = parseFloat(val.toFixed(1));
        } else {
            val = Math.round(val);
        }
        
        input.value = val;
        slider.value = val;
    });
}

window.updateSlider = function(field) {
    const slider = document.getElementById(`${field}-slider`);
    const input = document.getElementById(`${field}-value`);
    let val = parseFloat(input.value);
    
    // Clamp
    const min = parseFloat(slider.min), max = parseFloat(slider.max);
    if (val < min) val = min; if (val > max) val = max;

    slider.value = val;
    input.value = val;
    
    updateSliderFill(field);
    calculateRisk();
};

window.updateValue = function(field) {
    const slider = document.getElementById(`${field}-slider`);
    const input = document.getElementById(`${field}-value`);
    input.value = slider.value;
    updateSliderFill(field);
    calculateRisk();
};

function updateSliderFill(field) {
    const slider = document.getElementById(`${field}-slider`);
    const fill = document.getElementById(`${field}-fill`);
    if (!slider || !fill) return;

    const min = parseFloat(slider.min), max = parseFloat(slider.max), val = parseFloat(slider.value);
    const percent = ((val - min) / (max - min)) * 100;
    fill.style.width = `${percent}%`;
}

function updateUnitLabels() {
    const units = state.useMetric 
        ? { h: 'cm', w: 'cm', g: 'mmol/L', c: 'mmol/L' } 
        : { h: 'in', w: 'in', g: 'mg/dL', c: 'mg/dL' };

    // Header labels (with parentheses for US units)
    setUnitText('height-unit', units.h);
    setUnitText('waist-unit', units.w);
    setUnitText('fastGlu-unit', units.g);
    setUnitText('cholHDL-unit', units.c);
    setUnitText('cholTri-unit', units.c);
    
    // Value display labels (without parentheses)
    setValueUnitText('height-value-unit', units.h);
    setValueUnitText('waist-value-unit', units.w);
    setValueUnitText('fastGlu-value-unit', units.g);
    setValueUnitText('cholHDL-value-unit', units.c);
    setValueUnitText('cholTri-value-unit', units.c);
    
    // Update slider axis labels
    updateSliderAxisLabels();
}

function updateSliderAxisLabels() {
    const mode = state.useMetric ? 'si' : 'us';
    
    // Height
    const heightRange = CONFIG.RANGES.height[mode];
    setLabelText('height-min', heightRange[0]);
    setLabelText('height-mid', Math.round((heightRange[0] + heightRange[1]) / 2));
    setLabelText('height-max', heightRange[1]);
    
    // Waist
    const waistRange = CONFIG.RANGES.waist[mode];
    setLabelText('waist-min', waistRange[0]);
    setLabelText('waist-mid', Math.round((waistRange[0] + waistRange[1]) / 2));
    setLabelText('waist-max', waistRange[1]);
    
    // Triglycerides
    const triRange = CONFIG.RANGES.cholTri[mode];
    setLabelText('cholTri-min', state.useMetric ? triRange[0].toFixed(1) : triRange[0]);
    setLabelText('cholTri-mid', state.useMetric ? ((triRange[0] + triRange[1]) / 2).toFixed(1) : Math.round((triRange[0] + triRange[1]) / 2));
    setLabelText('cholTri-max', state.useMetric ? triRange[1].toFixed(1) : triRange[1]);
    
    // Glucose on heatmap
    const gluRange = CONFIG.RANGES.fastGlu[mode];
    setLabelText('glucose-min', state.useMetric ? gluRange[0].toFixed(1) : gluRange[0]);
    setLabelText('glucose-mid', state.useMetric ? ((gluRange[0] + gluRange[1]) / 2).toFixed(1) : Math.round((gluRange[0] + gluRange[1]) / 2));
    setLabelText('glucose-max', state.useMetric ? gluRange[1].toFixed(1) : gluRange[1]);
    setLabelText('glucose-axis-unit', state.useMetric ? '(mmol/L)' : '(mg/dL)');
}

function setLabelText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setUnitText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text.includes('mmol') ? text : `(${text})`;
}

function setValueUnitText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function convertInputValues() {
    const fields = ['height', 'waist', 'fastGlu', 'cholHDL', 'cholTri'];
    const conv = CONFIG.CONVERSIONS;
    const mode = state.useMetric ? 'si' : 'us';
    
    fields.forEach(field => {
        const input = document.getElementById(`${field}-value`);
        const slider = document.getElementById(`${field}-slider`);
        let val = parseFloat(input.value);
        
        // Convert the value
        if (state.useMetric) {
            // US -> SI
            if (field === 'height' || field === 'waist') val *= conv.heightToCm;
            if (field === 'fastGlu') val *= conv.gluToMmol;
            if (field === 'cholHDL') val *= conv.hdlToMmol;
            if (field === 'cholTri') val *= conv.triToMmol;
        } else {
            // SI -> US
            if (field === 'height' || field === 'waist') val /= conv.heightToCm;
            if (field === 'fastGlu') val /= conv.gluToMmol;
            if (field === 'cholHDL') val /= conv.hdlToMmol;
            if (field === 'cholTri') val /= conv.triToMmol;
        }
        
        // Get the range for clamping
        const range = CONFIG.RANGES[field][mode];
        const min = range[0];
        const max = range[1];
        const step = range[2];
        
        // Clamp to range
        if (val < min) val = min;
        if (val > max) val = max;
        
        // Round appropriately
        if (step < 1) {
            val = parseFloat(val.toFixed(1));
        } else {
            val = Math.round(val);
        }
        
        input.value = val;
        slider.value = val;
    });
}

function updateSliderRangesOnly() {
    const mode = state.useMetric ? 'si' : 'us';
    Object.keys(CONFIG.RANGES).forEach(field => {
        const slider = document.getElementById(`${field}-slider`);
        const input = document.getElementById(`${field}-value`);
        const range = CONFIG.RANGES[field][mode];

        if (slider && range) {
            slider.min = range[0];
            slider.max = range[1];
            slider.step = range[2];
            input.min = range[0];
            input.max = range[1];
            input.step = range[2];
        }
    });
}

function updateSliderRanges() {
    const mode = state.useMetric ? 'si' : 'us';
    Object.keys(CONFIG.RANGES).forEach(field => {
        const slider = document.getElementById(`${field}-slider`);
        const input = document.getElementById(`${field}-value`);
        const range = CONFIG.RANGES[field][mode];

        if (slider && range) {
            slider.min = range[0];
            slider.max = range[1];
            slider.step = range[2];
            input.min = range[0];
            input.max = range[1];
            input.step = range[2];
            updateSliderFill(field);
        }
    });
}

// ============================================
// 4. RISK CALCULATION
// ============================================

window.calculateRisk = function() {
    // Get Inputs
    const inputs = {
        age: parseFloat(document.getElementById('age-value').value) || 0,
        race: document.getElementById('race-toggle').checked ? 0 : 1, 
        parentHist: document.getElementById('parentHist-toggle').checked ? 1 : 0,
        sbp: parseFloat(document.getElementById('sbp-value').value) || 0,
        height: parseFloat(document.getElementById('height-value').value) || 0,
        waist: parseFloat(document.getElementById('waist-value').value) || 0,
        fastGlu: parseFloat(document.getElementById('fastGlu-value').value) || 0,
        cholHDL: parseFloat(document.getElementById('cholHDL-value').value) || 0,
        cholTri: parseFloat(document.getElementById('cholTri-value').value) || 0
    };

    // Normalize to Metric for Model
    let mVals = { ...inputs };
    if (!state.useMetric) {
        mVals.height = inputs.height * CONFIG.CONVERSIONS.heightToCm;
        mVals.waist = inputs.waist * CONFIG.CONVERSIONS.waistToCm;
        mVals.fastGlu = inputs.fastGlu * CONFIG.CONVERSIONS.gluToMmol;
        mVals.cholHDL = inputs.cholHDL * CONFIG.CONVERSIONS.hdlToMmol;
        mVals.cholTri = inputs.cholTri * CONFIG.CONVERSIONS.triToMmol;
    }

    // Calculate Score
    const B = CONFIG.BETAS;
    const score = B.sigma + 
        (B.age * mVals.age) + (B.race * mVals.race) + (B.parentHist * mVals.parentHist) +
        (B.sbp * mVals.sbp) + (B.waist * mVals.waist) + (B.height * mVals.height) +
        (B.fastGlu * mVals.fastGlu) + (B.cholHDL * mVals.cholHDL) + (B.cholTri * mVals.cholTri);

    const probability = 1 / (1 + Math.exp(-score));

    // Calculate Contributions (Mean Centered)
    const M = CONFIG.MEANS;
    const contributions = {
        age: B.age * (mVals.age - M.age),
        race: B.race * (mVals.race - M.race),
        parentHist: B.parentHist * (mVals.parentHist - M.parentHist),
        sbp: B.sbp * (mVals.sbp - M.sbp),
        waist: B.waist * (mVals.waist - M.waist),
        height: B.height * (mVals.height - M.height),
        fastGlu: B.fastGlu * (mVals.fastGlu - M.fastGlu),
        cholHDL: B.cholHDL * (mVals.cholHDL - M.cholHDL),
        cholTri: B.cholTri * (mVals.cholTri - M.cholTri)
    };

    updateRiskUI(probability * 100);
    updateChartUI(contributions);
    updateHeatmapWithContributions(contributions, probability * 100);
};

// ============================================
// 5. ENHANCED CHART UI (Tornado Plot)
// ============================================

function updateChartUI(contributions) {
    const container = document.getElementById('contribution-chart');
    if (!container) return;

    container.innerHTML = ''; 

    // 1. Convert to Array and Sort by Impact (Absolute Value)
    // This ensures the most important factors are at the top
    const items = Object.entries(contributions).map(([key, val]) => ({
        key,
        val,
        abs: Math.abs(val)
    }));
    
    // Sort descending by absolute impact
    items.sort((a, b) => b.abs - a.abs);

    // 2. Determine Scale
    // Find max value to define the 100% width of the bars
    const maxVal = Math.max(...items.map(i => i.abs)) || 0.1;

    // 3. Render Header (Optional, for clarity)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.fontSize = '10px';
    header.style.color = '#94a3b8';
    header.style.marginBottom = '5px';
    header.innerHTML = `
        <div style="width: 35%"></div>
        <div style="flex: 1; text-align: right; padding-right: 5px;">PROTECTIVE</div>
        <div style="width: 2px"></div>
        <div style="flex: 1; text-align: left; padding-left: 5px;">RISK</div>
    `;
    container.appendChild(header);

    // 4. Render Bars
    items.forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';
        row.style.fontSize = '12px';
        row.style.height = '24px';

        // LABEL (Left side)
        const label = document.createElement('div');
        label.style.width = '35%';
        label.style.overflow = 'hidden';
        label.style.whiteSpace = 'nowrap';
        label.style.textOverflow = 'ellipsis';
        label.style.color = '#475569';
        label.style.fontWeight = '500';
        label.textContent = CONFIG.LABELS[item.key];

        // CHART AREA (75%)
        // Split into Left (Negative) and Right (Positive) panes
        const chartArea = document.createElement('div');
        chartArea.style.flex = '1';
        chartArea.style.display = 'flex';
        chartArea.style.height = '100%';
        chartArea.style.position = 'relative';

        // Center Line
        const centerLine = document.createElement('div');
        centerLine.style.position = 'absolute';
        centerLine.style.left = '50%';
        centerLine.style.top = '0';
        centerLine.style.bottom = '0';
        centerLine.style.width = '1px';
        centerLine.style.backgroundColor = '#cbd5e1';
        centerLine.style.zIndex = '1';

        // Calculation
        const percentage = (item.abs / maxVal) * 100; // 0 to 100 relative to max
        
        // Only fill half the available width (50% is max for one side)
        // Actually, we use flex boxes for left/right sides.
        
        const leftPane = document.createElement('div');
        leftPane.style.flex = '1';
        leftPane.style.display = 'flex';
        leftPane.style.justifyContent = 'flex-end'; // Align bars to center
        leftPane.style.paddingRight = '2px';

        const rightPane = document.createElement('div');
        rightPane.style.flex = '1';
        rightPane.style.display = 'flex';
        rightPane.style.justifyContent = 'flex-start'; // Align bars to center
        rightPane.style.paddingLeft = '2px';

        const bar = document.createElement('div');
        bar.style.height = '100%';
        bar.style.width = `${percentage}%`;
        bar.style.borderRadius = '3px';
        bar.style.transition = 'width 0.3s ease';

        if (item.val < 0) {
            // Negative -> Left Pane (Green)
            bar.style.backgroundColor = '#10b981'; // Emerald 500
            leftPane.appendChild(bar);
        } else {
            // Positive -> Right Pane (Red)
            bar.style.backgroundColor = '#ef4444'; // Red 500
            rightPane.appendChild(bar);
        }

        // Assemble
        chartArea.appendChild(leftPane);
        chartArea.appendChild(centerLine);
        chartArea.appendChild(rightPane);

        row.appendChild(label);
        row.appendChild(chartArea);
        container.appendChild(row);
    });
}

function updateRiskUI(percentage) {
    const riskEl = document.getElementById('risk-percentage');
    if (riskEl) riskEl.textContent = percentage.toFixed(1);

    const circle = document.getElementById('risk-circle-fill');
    if (circle) {
        // Circumference 2*PI*45 approx 283
        const offset = 283 - (percentage / 100) * 283;
        circle.style.strokeDashoffset = offset;
        
        let color = '#22c55e'; 
        if (percentage >= 10) color = '#eab308';
        if (percentage >= 25) color = '#f97316';
        if (percentage >= 50) color = '#ef4444';
        circle.style.stroke = color;
    }

    const catEl = document.getElementById('risk-category');
    if (catEl) {
        let text = 'Low Risk', cls = 'low';
        if (percentage >= 10) { text = 'Moderate Risk'; cls = 'moderate'; }
        if (percentage >= 25) { text = 'High Risk'; cls = 'high'; }
        if (percentage >= 50) { text = 'Very High Risk'; cls = 'very-high'; }
        
        catEl.textContent = text;
        catEl.className = 'risk-category ' + cls;
    }
    
    updateHeatmap(percentage);
}

function updateHeatmap(risk) {
    // Legacy function - now handled by updateHeatmapWithContributions
}

function updateHeatmapWithContributions(contributions, risk) {
    const pointer = document.getElementById('heatmap-pointer');
    if (!pointer) return;
    
    // X-Axis: Glucose contribution (how much glucose adds to risk vs mean)
    // Positive contribution = higher glucose = move right
    // Negative contribution = lower glucose = move left
    const gluContribution = contributions.fastGlu;
    
    // Y-Axis: Sum of ALL OTHER risk contributions (excluding glucose)
    const otherContributions = 
        contributions.age + 
        contributions.race + 
        contributions.parentHist + 
        contributions.sbp + 
        contributions.waist + 
        contributions.height + 
        contributions.cholHDL + 
        contributions.cholTri;
    
    // Scale X: Glucose contribution typically ranges from -4 to +4
    // Map this to 5-95% horizontally
    const gluMin = -4;
    const gluMax = 4;
    const clampedGlu = Math.min(Math.max(gluContribution, gluMin), gluMax);
    const xPercent = 5 + ((clampedGlu - gluMin) / (gluMax - gluMin)) * 90;
    
    // Scale Y: Other contributions typically range from -3 to +3
    // Map this to 5-95% vertically (bottom to top)
    const otherMin = -3;
    const otherMax = 3;
    const clampedOther = Math.min(Math.max(otherContributions, otherMin), otherMax);
    const yPercent = 5 + ((clampedOther - otherMin) / (otherMax - otherMin)) * 90;
    
    pointer.style.left = xPercent + '%';
    pointer.style.bottom = yPercent + '%';
    
    // Update factor-specific treatment recommendations
    updateTreatmentRecommendations();
}

// ============================================
// 6. FACTOR-SPECIFIC TREATMENT RECOMMENDATIONS
// ============================================

function updateTreatmentRecommendations() {
    // Get current values in SI units
    const inputs = {
        fastGlu: parseFloat(document.getElementById('fastGlu-value').value) || 0,
        sbp: parseFloat(document.getElementById('sbp-value').value) || 0,
        cholHDL: parseFloat(document.getElementById('cholHDL-value').value) || 0,
        cholTri: parseFloat(document.getElementById('cholTri-value').value) || 0,
        waist: parseFloat(document.getElementById('waist-value').value) || 0
    };

    // Convert to SI if needed (with same rounding as display conversion for consistency)
    let siVals = { ...inputs };
    if (!state.useMetric) {
        siVals.fastGlu = parseFloat((inputs.fastGlu * CONFIG.CONVERSIONS.gluToMmol).toFixed(1));
        siVals.cholHDL = parseFloat((inputs.cholHDL * CONFIG.CONVERSIONS.hdlToMmol).toFixed(1));
        siVals.cholTri = parseFloat((inputs.cholTri * CONFIG.CONVERSIONS.triToMmol).toFixed(1));
        siVals.waist = Math.round(inputs.waist * CONFIG.CONVERSIONS.waistToCm);
    }

    // Determine which factors are elevated
    const elevatedFactors = [];
    const T = CONFIG.THRESHOLDS;

    if (siVals.fastGlu >= T.fastGlu.elevated) elevatedFactors.push('fastGlu');
    if (siVals.sbp >= T.sbp.elevated) elevatedFactors.push('sbp');
    if (siVals.cholHDL <= T.cholHDL.low) elevatedFactors.push('cholHDL');  // Inverse - low HDL is bad
    if (siVals.cholTri >= T.cholTri.elevated) elevatedFactors.push('cholTri');
    if (siVals.waist >= T.waist.elevated) elevatedFactors.push('waist');

    // Update the dynamic treatment recommendations section
    const container = document.getElementById('dynamic-treatments');
    if (!container) return;

    // Clear previous recommendations
    container.innerHTML = '';

    if (elevatedFactors.length === 0) {
        container.innerHTML = `
            <div class="treatment-ok">
                <span class="material-icons-round">check_circle</span>
                <p>All modifiable risk factors are within normal range. Continue maintaining a healthy lifestyle.</p>
            </div>
        `;
        return;
    }

    // Build recommendations for each elevated factor
    elevatedFactors.forEach(factor => {
        const treatment = CONFIG.TREATMENTS[factor];
        if (!treatment) return;

        const factorDiv = document.createElement('div');
        factorDiv.className = 'factor-treatment indicated';
        factorDiv.id = treatment.id;

        let therapiesHTML = treatment.therapies.map(t => `
            <div class="therapy-mini">
                <span class="material-icons-round indicated-heart">favorite</span>
                <div>
                    <strong>${t.name}:</strong> ${t.desc}
                </div>
            </div>
        `).join('');

        factorDiv.innerHTML = `
            <div class="factor-header">
                <span class="material-icons-round factor-icon">${treatment.icon}</span>
                <h5>${treatment.title}</h5>
            </div>
            <div class="factor-therapies">
                ${therapiesHTML}
            </div>
        `;

        container.appendChild(factorDiv);
    });
}