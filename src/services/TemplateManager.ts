import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { logger } from './Logger';

/**
 * Represents a custom template for prompt refinement
 */
export interface CustomTemplate {
    id: string;
    name: string;
    description: string;
    content: string;
    isBuiltIn: boolean;
    category: 'coding' | 'writing' | 'analysis' | 'general' | 'custom';
    createdAt: number;
    updatedAt: number;
}

/**
 * Default templates provided by the extension
 */
const BUILT_IN_TEMPLATES: CustomTemplate[] = [
    {
        id: 'default',
        name: 'Default',
        description: 'Standard prompt refinement for general use',
        content: '', // Uses prompt_template.md from file system
        isBuiltIn: true,
        category: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'strict',
        name: 'Strict Mode',
        description: 'Enforces strict output format without conversational filler',
        content: '', // Uses prompt_template_strict.md from file system
        isBuiltIn: true,
        category: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'coding',
        name: 'Code Assistant',
        description: 'Optimized for coding tasks and technical prompts',
        content: `## PROMPT TEMPLATE - Code Assistant

Act as an expert software development assistant.
Refine the user's coding prompt to be:
- Clear and specific about the programming task
- Include relevant context (language, framework, constraints)
- Specify expected output format (code, explanation, both)
- Mention any error handling or edge cases to consider

### Output Format:
[Context]
Programming language and relevant technical context

[Objective]
Clear statement of what needs to be implemented

[Requirements]
- Functional requirements
- Technical constraints
- Performance considerations
- Error handling needs

[Expected Output]
Code, explanation, or both with specific format

Maintain the original language of the user's prompt.`,
        isBuiltIn: true,
        category: 'coding',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'writing',
        name: 'Technical Writing',
        description: 'For documentation, emails, and technical content',
        content: `## PROMPT TEMPLATE - Technical Writing

Act as a technical writing expert.
Refine the user's writing prompt to be:
- Clear about the target audience and tone
- Specific about content structure and format
- Include any style guidelines or constraints
- Define the purpose and key messages

### Output Format:
[Audience]
Target readers and their background

[Purpose]
Main goal of the content

[Tone and Style]
Formal/informal, technical level, voice

[Structure]
Outline or sections to include

[Key Points]
Essential information to convey

[Constraints]
Length, format, style guide requirements

Maintain the original language of the user's prompt.`,
        isBuiltIn: true,
        category: 'writing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: 'analysis',
        name: 'Data Analysis',
        description: 'For data analysis, research, and investigation tasks',
        content: `## PROMPT TEMPLATE - Data Analysis

Act as a data analysis expert.
Refine the user's analysis prompt to be:
- Clear about data sources and format
- Specific about analysis methods and tools
- Define expected insights and deliverables
- Include any constraints or assumptions

### Output Format:
[Data Context]
Source, format, and characteristics of data

[Analysis Goal]
What questions need to be answered

[Methodology]
Tools, techniques, and approaches to use

[Deliverables]
Reports, visualizations, code, or insights

[Constraints]
Time, resources, technical limitations

[Success Criteria]
How to evaluate the analysis

Maintain the original language of the user's prompt.`,
        isBuiltIn: true,
        category: 'analysis',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
];

/**
 * Manages custom templates for prompt refinement
 */
export class TemplateManager {
    private static instance: TemplateManager;
    private context?: vscode.ExtensionContext;
    private readonly STORAGE_KEY = 'promptRefiner.customTemplates';

    private constructor() {
        // Private constructor to prevent direct instantiation - use getInstance()
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): TemplateManager {
        if (!TemplateManager.instance) {
            TemplateManager.instance = new TemplateManager();
        }
        return TemplateManager.instance;
    }

    /**
     * Initialize the manager
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        logger.debug('TemplateManager initialized');
    }

    /**
     * Get all available templates (built-in + custom)
     */
    public async getAllTemplates(): Promise<CustomTemplate[]> {
        const customTemplates = await this.getCustomTemplates();
        return [...BUILT_IN_TEMPLATES, ...customTemplates];
    }

    /**
     * Get only custom templates from storage
     */
    public async getCustomTemplates(): Promise<CustomTemplate[]> {
        if (!this.context) {
            return [];
        }

        try {
            const templates = await this.context.globalState.get<CustomTemplate[]>(this.STORAGE_KEY, []);
            return templates;
        } catch (error) {
            logger.error('Failed to load custom templates', error as Error);
            return [];
        }
    }

    /**
     * Get a specific template by ID
     */
    public async getTemplate(id: string): Promise<CustomTemplate | undefined> {
        const allTemplates = await this.getAllTemplates();
        return allTemplates.find(t => t.id === id);
    }

    /**
     * Create a new custom template
     */
    public async createTemplate(template: Omit<CustomTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>): Promise<CustomTemplate> {
        if (!this.context) {
            throw new Error('TemplateManager not initialized');
        }

        const now = Date.now();
        const newTemplate: CustomTemplate = {
            ...template,
            id: this.generateId(),
            isBuiltIn: false,
            createdAt: now,
            updatedAt: now,
        };

        const templates = await this.getCustomTemplates();
        templates.push(newTemplate);
        
        await this.context.globalState.update(this.STORAGE_KEY, templates);
        logger.info('Custom template created', { templateId: newTemplate.id, name: newTemplate.name });
        
        return newTemplate;
    }

    /**
     * Update an existing custom template
     */
    public async updateTemplate(id: string, updates: Partial<Omit<CustomTemplate, 'id' | 'createdAt' | 'isBuiltIn'>>): Promise<CustomTemplate | null> {
        if (!this.context) {
            throw new Error('TemplateManager not initialized');
        }

        const templates = await this.getCustomTemplates();
        const index = templates.findIndex(t => t.id === id);
        
        if (index === -1) {
            logger.warn('Template not found for update', { templateId: id });
            return null;
        }

        templates[index] = {
            ...templates[index],
            ...updates,
            updatedAt: Date.now(),
        };

        await this.context.globalState.update(this.STORAGE_KEY, templates);
        logger.info('Template updated', { templateId: id });
        
        return templates[index];
    }

    /**
     * Delete a custom template
     */
    public async deleteTemplate(id: string): Promise<boolean> {
        if (!this.context) {
            throw new Error('TemplateManager not initialized');
        }

        const templates = await this.getCustomTemplates();
        const filtered = templates.filter(t => t.id !== id);
        
        if (filtered.length === templates.length) {
            logger.warn('Template not found for deletion', { templateId: id });
            return false;
        }

        await this.context.globalState.update(this.STORAGE_KEY, filtered);
        logger.info('Template deleted', { templateId: id });
        return true;
    }

    /**
     * Export templates to JSON file
     */
    public async exportTemplates(): Promise<void> {
        const templates = await this.getCustomTemplates();
        
        if (templates.length === 0) {
            vscode.window.showWarningMessage('No custom templates to export');
            return;
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            templates: templates,
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        
        // Open save dialog
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('prompt-refiner-templates.json'),
            filters: {
                'JSON': ['json'],
            },
        });

        if (uri) {
            try {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf8'));
                vscode.window.showInformationMessage(`Exported ${templates.length} templates successfully!`);
                logger.info('Templates exported', { count: templates.length, path: uri.fsPath });
            } catch (error) {
                logger.error('Failed to export templates', error as Error);
                vscode.window.showErrorMessage('Failed to export templates');
            }
        }
    }

    /**
     * Import templates from JSON file
     */
    public async importTemplates(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'JSON': ['json'],
            },
            openLabel: 'Import Templates',
        });

        if (!uris || uris.length === 0) {
            return;
        }

        try {
            const content = await vscode.workspace.fs.readFile(uris[0]);
            const jsonContent = JSON.parse(content.toString());
            
            if (!jsonContent.templates || !Array.isArray(jsonContent.templates)) {
                throw new Error('Invalid template file format');
            }

            const importedTemplates = jsonContent.templates as CustomTemplate[];
            const currentTemplates = await this.getCustomTemplates();
            
            // Add imported templates with new IDs to avoid conflicts
            let importedCount = 0;
            for (const template of importedTemplates) {
                // Check if template with same name already exists
                const exists = currentTemplates.some(t => t.name === template.name);
                if (!exists) {
                    await this.createTemplate({
                        name: template.name,
                        description: template.description,
                        content: template.content,
                        category: template.category || 'custom',
                    });
                    importedCount++;
                }
            }

            vscode.window.showInformationMessage(
                `Imported ${importedCount} templates successfully! ${importedTemplates.length - importedCount} skipped (duplicates)`
            );
            logger.info('Templates imported', { imported: importedCount, total: importedTemplates.length });
        } catch (error) {
            logger.error('Failed to import templates', error as Error);
            vscode.window.showErrorMessage(`Failed to import templates: ${(error as Error).message}`);
        }
    }

    /**
     * Get templates by category
     */
    public async getTemplatesByCategory(category: CustomTemplate['category']): Promise<CustomTemplate[]> {
        const allTemplates = await this.getAllTemplates();
        return allTemplates.filter(t => t.category === category);
    }

    /**
     * Generate a unique ID using cryptographically secure randomness
     */
    private generateId(): string {
        return `template-${Date.now()}-${randomBytes(8).toString('hex')}`;
    }
}
