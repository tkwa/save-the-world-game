#!/usr/bin/env node

// Event validation script for Critical Path game
// Usage: node validate-events.js

const fs = require('fs');
const path = require('path');

// Simple JSON schema validator (subset of functionality)
class SimpleValidator {
    constructor(schema) {
        this.schema = schema;
        this.errors = [];
    }

    validate(data, schema = this.schema, path = '') {
        this.errors = [];
        this._validate(data, schema, path);
        return {
            valid: this.errors.length === 0,
            errors: this.errors
        };
    }

    _validate(data, schema, path) {
        // Type validation
        if (schema.type) {
            if (schema.type === 'object' && (typeof data !== 'object' || Array.isArray(data) || data === null)) {
                this.errors.push(`${path}: Expected object, got ${typeof data}`);
                return;
            }
            if (schema.type === 'array' && !Array.isArray(data)) {
                this.errors.push(`${path}: Expected array, got ${typeof data}`);
                return;
            }
            if (schema.type === 'string' && typeof data !== 'string') {
                this.errors.push(`${path}: Expected string, got ${typeof data}`);
                return;
            }
            if (schema.type === 'number' && typeof data !== 'number') {
                this.errors.push(`${path}: Expected number, got ${typeof data}`);
                return;
            }
            if (schema.type === 'boolean' && typeof data !== 'boolean') {
                this.errors.push(`${path}: Expected boolean, got ${typeof data}`);
                return;
            }
        }

        // Const validation
        if (schema.const !== undefined && data !== schema.const) {
            this.errors.push(`${path}: Expected constant value "${schema.const}", got "${data}"`);
        }

        // Enum validation
        if (schema.enum && !schema.enum.includes(data)) {
            this.errors.push(`${path}: Value "${data}" not in allowed values [${schema.enum.join(', ')}]`);
        }

        // Pattern validation
        if (schema.pattern && typeof data === 'string') {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(data)) {
                this.errors.push(`${path}: String "${data}" does not match pattern ${schema.pattern}`);
            }
        }

        // String length validation
        if (schema.minLength && typeof data === 'string' && data.length < schema.minLength) {
            this.errors.push(`${path}: String length ${data.length} is less than minimum ${schema.minLength}`);
        }

        // Number validation
        if (schema.minimum !== undefined && typeof data === 'number' && data < schema.minimum) {
            this.errors.push(`${path}: Number ${data} is less than minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && typeof data === 'number' && data > schema.maximum) {
            this.errors.push(`${path}: Number ${data} is greater than maximum ${schema.maximum}`);
        }

        // Array validation
        if (schema.type === 'array' && Array.isArray(data)) {
            if (schema.minItems && data.length < schema.minItems) {
                this.errors.push(`${path}: Array length ${data.length} is less than minimum ${schema.minItems}`);
            }
            if (schema.items) {
                data.forEach((item, index) => {
                    this._validate(item, schema.items, `${path}[${index}]`);
                });
            }
        }

        // Object validation
        if (schema.type === 'object' && typeof data === 'object' && !Array.isArray(data) && data !== null) {
            // Required properties
            if (schema.required) {
                schema.required.forEach(prop => {
                    if (!(prop in data)) {
                        this.errors.push(`${path}: Missing required property "${prop}"`);
                    }
                });
            }

            // Properties validation
            if (schema.properties) {
                Object.keys(data).forEach(prop => {
                    if (schema.properties[prop]) {
                        this._validate(data[prop], schema.properties[prop], `${path}.${prop}`);
                    } else if (schema.additionalProperties === false) {
                        this.errors.push(`${path}: Unexpected property "${prop}"`);
                    }
                });
            }

            // Pattern properties validation
            if (schema.patternProperties) {
                Object.keys(data).forEach(prop => {
                    let matched = false;
                    Object.keys(schema.patternProperties).forEach(pattern => {
                        const regex = new RegExp(pattern);
                        if (regex.test(prop)) {
                            matched = true;
                            this._validate(data[prop], schema.patternProperties[pattern], `${path}.${prop}`);
                        }
                    });
                    if (!matched && schema.additionalProperties === false) {
                        this.errors.push(`${path}: Property "${prop}" does not match any pattern`);
                    }
                });
            }
        }

        // $ref validation (simplified)
        if (schema.$ref && this.schema.definitions) {
            const refPath = schema.$ref.replace('#/definitions/', '');
            const refSchema = this.schema.definitions[refPath];
            if (refSchema) {
                this._validate(data, refSchema, path);
            }
        }

        // anyOf validation (simplified - just check if at least one passes)
        if (schema.anyOf) {
            const originalErrors = [...this.errors];
            let anyValid = false;
            
            for (const subSchema of schema.anyOf) {
                this.errors = [...originalErrors];
                this._validate(data, subSchema, path);
                if (this.errors.length === originalErrors.length) {
                    anyValid = true;
                    break;
                }
            }
            
            if (!anyValid) {
                this.errors = originalErrors;
                this.errors.push(`${path}: Does not match any of the anyOf schemas`);
            }
        }
    }
}

function validateEvents() {
    console.log('🔍 Validating events.json against schema...\n');

    // Load schema
    let schema;
    try {
        const schemaContent = fs.readFileSync('events.schema.json', 'utf8');
        schema = JSON.parse(schemaContent);
    } catch (error) {
        console.error('❌ Failed to load schema file:', error.message);
        process.exit(1);
    }

    // Load events data
    let eventsData;
    try {
        const eventsContent = fs.readFileSync('events.json', 'utf8');
        eventsData = JSON.parse(eventsContent);
    } catch (error) {
        console.error('❌ Failed to load events.json:', error.message);
        process.exit(1);
    }

    // Validate
    const validator = new SimpleValidator(schema);
    const result = validator.validate(eventsData);

    if (result.valid) {
        console.log('✅ events.json is valid according to the schema!');
        console.log(`📊 Validation stats:`);
        console.log(`   • Special events: ${Object.keys(eventsData.specialEvents).length}`);
        console.log(`   • Default events: ${eventsData.defaultEvents.length}`);
        
        // Count events by type
        const eventTypes = {
            withRequirements: 0,
            withAILevelRange: 0,
            withConditionalChoices: 0,
            withCustomHandlers: 0,
            withOtherTexts: 0,
            disabled: 0
        };
        
        eventsData.defaultEvents.forEach(event => {
            if (event.requires && event.requires.length > 0) eventTypes.withRequirements++;
            if (event.aiLevelRange) eventTypes.withAILevelRange++;
            if (event.choices && event.choices.some(c => c.condition)) eventTypes.withConditionalChoices++;
            if (event.customHandler) eventTypes.withCustomHandlers++;
            if (event.other_texts) eventTypes.withOtherTexts++;
            if (event.weight === 0) eventTypes.disabled++;
        });
        
        console.log(`   • Events with requirements: ${eventTypes.withRequirements}`);
        console.log(`   • Events with AI level ranges: ${eventTypes.withAILevelRange}`);
        console.log(`   • Events with conditional choices: ${eventTypes.withConditionalChoices}`);
        console.log(`   • Events with custom handlers: ${eventTypes.withCustomHandlers}`);
        console.log(`   • Events with other_texts: ${eventTypes.withOtherTexts}`);
        console.log(`   • Disabled events: ${eventTypes.disabled}`);
        
        return true;
    } else {
        console.log('❌ events.json validation failed:');
        result.errors.forEach(error => {
            console.log(`   • ${error}`);
        });
        return false;
    }
}

// Run validation
if (require.main === module) {
    const isValid = validateEvents();
    process.exit(isValid ? 0 : 1);
}

module.exports = { validateEvents, SimpleValidator };