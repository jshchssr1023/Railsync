/**
 * Shop Filter Controller
 * Handles proximity-based and capability-based shop filtering
 */

import { Request, Response } from 'express';
import logger from '../config/logger';
import * as shopFilterService from '../services/shopFilter.service';
import { FilterOptions } from '../services/shopFilter.service';

/**
 * GET /api/shops/filter
 * Combined filter: proximity + capabilities + other options
 */
export async function filterShops(req: Request, res: Response): Promise<void> {
  try {
    const {
      latitude,
      longitude,
      radiusMiles,
      capabilityTypes,
      tier,
      preferredNetworkOnly,
      region,
      designation,
    } = req.query;

    const options: FilterOptions = {};

    // Parse latitude/longitude
    if (latitude !== undefined && longitude !== undefined) {
      options.latitude = parseFloat(latitude as string);
      options.longitude = parseFloat(longitude as string);

      if (isNaN(options.latitude) || isNaN(options.longitude)) {
        res.status(400).json({
          success: false,
          error: 'Invalid latitude or longitude',
        });
        return;
      }
    }

    // Parse radius
    if (radiusMiles !== undefined) {
      options.radiusMiles = parseFloat(radiusMiles as string);
      if (isNaN(options.radiusMiles) || options.radiusMiles <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid radius. Must be a positive number.',
        });
        return;
      }
    }

    // Parse capability types (comma-separated or array)
    if (capabilityTypes) {
      if (Array.isArray(capabilityTypes)) {
        options.capabilityTypes = capabilityTypes as string[];
      } else {
        options.capabilityTypes = (capabilityTypes as string).split(',').map(s => s.trim());
      }
    }

    // Parse tier
    if (tier !== undefined) {
      options.tier = parseInt(tier as string, 10);
      if (isNaN(options.tier)) {
        res.status(400).json({
          success: false,
          error: 'Invalid tier. Must be a number.',
        });
        return;
      }
    }

    // Parse preferred network
    if (preferredNetworkOnly === 'true' || preferredNetworkOnly === '1') {
      options.preferredNetworkOnly = true;
    }

    // Parse region
    if (region) {
      options.region = region as string;
    }

    // Parse designation (repair, storage, scrap)
    if (designation) {
      const des = designation as string;
      if (['repair', 'storage', 'scrap'].includes(des)) {
        options.designation = des as 'repair' | 'storage' | 'scrap';
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid designation. Must be repair, storage, or scrap.',
        });
        return;
      }
    }

    const shops = await shopFilterService.filterShops(options);

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      filters: options,
    });
  } catch (error) {
    logger.error({ err: error }, 'Filter shops error');
    res.status(500).json({
      success: false,
      error: 'Failed to filter shops',
    });
  }
}

/**
 * GET /api/shops/nearby
 * Find shops within a radius of a given point
 */
export async function findNearbyShops(req: Request, res: Response): Promise<void> {
  try {
    const { latitude, longitude, radiusMiles } = req.query;

    if (!latitude || !longitude) {
      res.status(400).json({
        success: false,
        error: 'latitude and longitude are required',
      });
      return;
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude',
      });
      return;
    }

    const radius = radiusMiles ? parseFloat(radiusMiles as string) : 500;
    if (isNaN(radius) || radius <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid radius. Must be a positive number.',
      });
      return;
    }

    const shops = await shopFilterService.findShopsWithinRadius(lat, lon, radius);

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      params: { latitude: lat, longitude: lon, radiusMiles: radius },
    });
  } catch (error) {
    logger.error({ err: error }, 'Find nearby shops error');
    res.status(500).json({
      success: false,
      error: 'Failed to find nearby shops',
    });
  }
}

/**
 * GET /api/shops/filter-options
 * Get filter options for dropdowns (regions, tiers, capability types)
 */
export async function getFilterOptions(req: Request, res: Response): Promise<void> {
  try {
    const options = await shopFilterService.getFilterOptions();

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get filter options error');
    res.status(500).json({
      success: false,
      error: 'Failed to get filter options',
    });
  }
}

/**
 * GET /api/shops/capability-types
 * Get list of all capability types
 */
export async function getCapabilityTypes(req: Request, res: Response): Promise<void> {
  try {
    const capabilityTypes = await shopFilterService.getCapabilityTypes();

    res.json({
      success: true,
      data: capabilityTypes,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get capability types error');
    res.status(500).json({
      success: false,
      error: 'Failed to get capability types',
    });
  }
}

/**
 * GET /api/shops/capability-values/:type
 * Get unique values for a capability type
 */
export async function getCapabilityValues(req: Request, res: Response): Promise<void> {
  try {
    const { type } = req.params;

    if (!type) {
      res.status(400).json({
        success: false,
        error: 'Capability type is required',
      });
      return;
    }

    const values = await shopFilterService.getCapabilityValues(type);

    res.json({
      success: true,
      data: values,
      capabilityType: type,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get capability values error');
    res.status(500).json({
      success: false,
      error: 'Failed to get capability values',
    });
  }
}

/**
 * GET /api/shops/by-capabilities
 * Filter shops by capability types
 */
export async function filterByCapabilities(req: Request, res: Response): Promise<void> {
  try {
    const { capabilityTypes } = req.query;

    let types: string[] = [];
    if (capabilityTypes) {
      if (Array.isArray(capabilityTypes)) {
        types = capabilityTypes as string[];
      } else {
        types = (capabilityTypes as string).split(',').map(s => s.trim());
      }
    }

    const shops = await shopFilterService.filterShopsByCapabilities(types);

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      filters: { capabilityTypes: types },
    });
  } catch (error) {
    logger.error({ err: error }, 'Filter by capabilities error');
    res.status(500).json({
      success: false,
      error: 'Failed to filter shops by capabilities',
    });
  }
}

/**
 * GET /api/shops/regions
 * Get list of all regions
 */
export async function getRegions(req: Request, res: Response): Promise<void> {
  try {
    const regions = await shopFilterService.getRegions();

    res.json({
      success: true,
      data: regions,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get regions error');
    res.status(500).json({
      success: false,
      error: 'Failed to get regions',
    });
  }
}

export default {
  filterShops,
  findNearbyShops,
  getFilterOptions,
  getCapabilityTypes,
  getCapabilityValues,
  filterByCapabilities,
  getRegions,
};
