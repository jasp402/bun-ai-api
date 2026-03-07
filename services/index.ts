import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
export * from './cerebras';
export * from './db';
import type { AIService, ServiceStatus } from '../types';

interface ServiceFactory {
    create: () => AIService;
    isEnabled: () => boolean;
}

// Cache for services
let activeServicesMap: Record<string, AIService> = {};
let allFactories: { key: string, factory: ServiceFactory }[] = [];
let serviceValidationStatus: Record<string, boolean> = {};

// Initialize services once
export const initializeServices = async () => {
    const servicesDir = import.meta.dir;
    const files = await readdir(servicesDir);
    activeServicesMap = {};
    allFactories = [];
    serviceValidationStatus = {};

    for (const file of files) {
        if ((file.endsWith('.ts') || file.endsWith('.js')) && file !== 'index.ts' && !file.endsWith('.d.ts')) {
            try {
                const module = await import(join(servicesDir, file));

                for (const key of Object.keys(module)) {
                    const candidate = module[key];
                    if (
                        candidate &&
                        typeof candidate === 'object' &&
                        typeof candidate.create === 'function' &&
                        typeof candidate.isEnabled === 'function'
                    ) {
                        const factory = candidate as ServiceFactory;
                        const id = key.replace(/Factory$/, '');
                        allFactories.push({ key: id, factory });

                        if (factory.isEnabled()) {
                            console.log(`Enabling service ${id}...`);
                            const instance = factory.create();
                            activeServicesMap[id] = instance;

                            // Validate API Key if supported
                            if (instance.validate) {
                                instance.validate().then(isValid => {
                                    serviceValidationStatus[id] = isValid;
                                    if (isValid) console.log(`✅ Service ${id} is VALID.`);
                                    else console.warn(`❌ Service ${id} is INVALID.`);
                                }).catch(() => {
                                    serviceValidationStatus[id] = false;
                                    console.warn(`❌ Service ${id} validation FAILED.`);
                                });
                            } else {
                                serviceValidationStatus[id] = true; // Assume true if no validation provided
                            }

                        } else {
                            console.log(`Disabling service ${id} (Not configured)`);
                        }
                    }
                }
            } catch (err) {
                console.error(`Error loading service ${file}:`, err);
            }
        }
    }
}

export const getActiveServices = () => Object.values(activeServicesMap);

export const getAllServicesStatus = (): ServiceStatus[] => {
    return allFactories.map(({ key, factory }) => {
        const isEnabled = factory.isEnabled();
        const instance = activeServicesMap[key];

        return {
            id: key,
            // If instance exists, use its name/model/metrics, otherwise create temp one for metadata
            name: instance?.name || factory.create().name,
            model: instance?.model || factory.create().model,
            isOnline: isEnabled,
            isValid: serviceValidationStatus[key],
            metrics: instance?.metrics
        };
    });
};