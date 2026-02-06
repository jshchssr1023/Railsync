import { Request, Response } from 'express';
import * as budgetScenarioService from '../services/budgetScenario.service';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function listScenarios(req: Request, res: Response): Promise<void> {
  try {
    const scenarios = await budgetScenarioService.listScenarios();
    res.json({ success: true, data: scenarios });
  } catch (error: unknown) {
    console.error('List budget scenarios error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getScenario(req: Request, res: Response): Promise<void> {
  try {
    const scenario = await budgetScenarioService.getScenario(req.params.id);
    if (!scenario) {
      res.status(404).json({ success: false, error: 'Budget scenario not found' });
      return;
    }
    res.json({ success: true, data: scenario });
  } catch (error: unknown) {
    console.error('Get budget scenario error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function createScenario(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { name, sliders } = req.body;

    if (!name || !sliders) {
      res.status(400).json({ success: false, error: 'Name and sliders are required' });
      return;
    }

    const scenario = await budgetScenarioService.createCustomScenario(name, sliders, userId);
    res.status(201).json({ success: true, data: scenario });
  } catch (error: unknown) {
    console.error('Create budget scenario error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateScenario(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    const { name, sliders } = req.body;

    const scenario = await budgetScenarioService.updateCustomScenario(req.params.id, { name, sliders }, userId);
    if (!scenario) {
      res.status(404).json({ success: false, error: 'Budget scenario not found or is a system scenario' });
      return;
    }
    res.json({ success: true, data: scenario });
  } catch (error: unknown) {
    console.error('Update budget scenario error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function deleteScenario(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await budgetScenarioService.deleteCustomScenario(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Budget scenario not found or is a system scenario' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete budget scenario error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function calculateImpact(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const impact = await budgetScenarioService.calculateImpact(req.params.id, fiscalYear);
    if (!impact) {
      res.status(404).json({ success: false, error: 'Budget scenario not found' });
      return;
    }
    res.json({ success: true, data: impact });
  } catch (error: unknown) {
    console.error('Calculate budget scenario impact error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getPipelineMetrics(req: Request, res: Response): Promise<void> {
  try {
    const fiscalYear = parseInt(req.query.fiscal_year as string) || new Date().getFullYear();
    const metrics = await budgetScenarioService.getPipelineMetrics(fiscalYear);
    res.json({ success: true, data: metrics });
  } catch (error: unknown) {
    console.error('Get pipeline metrics error:', error);
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
}
