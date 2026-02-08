import { Request, Response } from 'express';
import logger from '../config/logger';
import userManagementService from '../services/userManagement.service';
import { logFromRequest } from '../services/audit.service';
import { ApiResponse } from '../types';

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const { role, customer_id, is_active, search } = req.query;

    const users = await userManagementService.listUsers({
      role: role as string,
      customer_id: customer_id as string | undefined,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      search: search as string,
    });

    res.json({
      success: true,
      data: users,
    } as ApiResponse<typeof users>);
  } catch (error) {
    logger.error({ err: error }, 'Error listing users');
    res.status(500).json({
      success: false,
      error: 'Failed to list users',
    } as ApiResponse<null>);
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await userManagementService.getUserById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
      return;
    }

    // Get user permissions
    const permissions = await userManagementService.getUserPermissions(userId);

    res.json({
      success: true,
      data: {
        ...user,
        permissions: permissions.map(p => p.permission_code),
      },
    } as ApiResponse<any>);
  } catch (error) {
    logger.error({ err: error }, 'Error getting user');
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    } as ApiResponse<null>);
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      role,
      organization,
      customer_id,
      phone,
      job_title,
      department,
    } = req.body;

    if (!email || !password || !first_name || !last_name) {
      res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required',
      } as ApiResponse<null>);
      return;
    }

    const user = await userManagementService.createUser({
      email,
      password,
      first_name,
      last_name,
      role,
      organization,
      customer_id,
      phone,
      job_title,
      department,
    });

    await logFromRequest(req, 'create', 'user', user.id, undefined, {
      email,
      role,
      customer_id,
    });

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully',
    } as ApiResponse<typeof user>);
  } catch (error: any) {
    logger.error({ err: error }, 'Error creating user');

    if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
      res.status(409).json({
        success: false,
        error: 'A user with this email already exists',
      } as ApiResponse<null>);
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create user',
    } as ApiResponse<null>);
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Get current user for audit
    const currentUser = await userManagementService.getUserById(userId);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse<null>);
      return;
    }

    const user = await userManagementService.updateUser(userId, updateData);

    await logFromRequest(req, 'update', 'user', userId, currentUser, updateData);

    res.json({
      success: true,
      data: user,
      message: 'User updated successfully',
    } as ApiResponse<typeof user>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating user');
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    } as ApiResponse<null>);
  }
}

export async function updatePassword(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as ApiResponse<null>);
      return;
    }

    await userManagementService.updatePassword(userId, password);
    await logFromRequest(req, 'password_change', 'user', userId);

    res.json({
      success: true,
      message: 'Password updated successfully',
    } as ApiResponse<null>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating password');
    res.status(500).json({
      success: false,
      error: 'Failed to update password',
    } as ApiResponse<null>);
  }
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    // Prevent self-deactivation
    if (userId === req.user?.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot deactivate yourself',
      } as ApiResponse<null>);
      return;
    }

    await userManagementService.deactivateUser(userId);
    await logFromRequest(req, 'deactivate', 'user', userId);

    res.json({
      success: true,
      message: 'User deactivated successfully',
    } as ApiResponse<null>);
  } catch (error) {
    logger.error({ err: error }, 'Error deactivating user');
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate user',
    } as ApiResponse<null>);
  }
}

export async function activateUser(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    await userManagementService.activateUser(userId);
    await logFromRequest(req, 'activate', 'user', userId);

    res.json({
      success: true,
      message: 'User activated successfully',
    } as ApiResponse<null>);
  } catch (error) {
    logger.error({ err: error }, 'Error activating user');
    res.status(500).json({
      success: false,
      error: 'Failed to activate user',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// PERMISSIONS
// =============================================================================

export async function listPermissions(req: Request, res: Response): Promise<void> {
  try {
    const permissions = await userManagementService.listPermissions();

    // Group by category
    const grouped = permissions.reduce((acc: any, p: any) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        permissions,
        grouped,
      },
    } as ApiResponse<any>);
  } catch (error) {
    logger.error({ err: error }, 'Error listing permissions');
    res.status(500).json({
      success: false,
      error: 'Failed to list permissions',
    } as ApiResponse<null>);
  }
}

export async function getUserPermissions(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const permissions = await userManagementService.getUserPermissions(userId);

    res.json({
      success: true,
      data: permissions.map(p => p.permission_code),
    } as ApiResponse<string[]>);
  } catch (error) {
    logger.error({ err: error }, 'Error getting user permissions');
    res.status(500).json({
      success: false,
      error: 'Failed to get user permissions',
    } as ApiResponse<null>);
  }
}

export async function updateUserPermissions(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { grant, revoke, deny } = req.body;

    const grantedBy = req.user?.id;

    if (grant && Array.isArray(grant)) {
      for (const code of grant) {
        await userManagementService.grantUserPermission(userId, code, grantedBy);
      }
    }

    if (revoke && Array.isArray(revoke)) {
      for (const code of revoke) {
        await userManagementService.revokeUserPermission(userId, code);
      }
    }

    if (deny && Array.isArray(deny)) {
      for (const code of deny) {
        await userManagementService.denyUserPermission(userId, code, grantedBy);
      }
    }

    await logFromRequest(req, 'update_permissions', 'user', userId, undefined, { grant, revoke, deny });

    const permissions = await userManagementService.getUserPermissions(userId);

    res.json({
      success: true,
      data: permissions.map(p => p.permission_code),
      message: 'Permissions updated successfully',
    } as ApiResponse<string[]>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating user permissions');
    res.status(500).json({
      success: false,
      error: 'Failed to update permissions',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// USER GROUPS
// =============================================================================

export async function listGroups(req: Request, res: Response): Promise<void> {
  try {
    const { customer_id } = req.query;
    const groups = await userManagementService.listGroups(
      customer_id as string | undefined
    );

    res.json({
      success: true,
      data: groups,
    } as ApiResponse<typeof groups>);
  } catch (error) {
    logger.error({ err: error }, 'Error listing groups');
    res.status(500).json({
      success: false,
      error: 'Failed to list groups',
    } as ApiResponse<null>);
  }
}

export async function getGroupById(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const group = await userManagementService.getGroupById(parseInt(groupId));

    if (!group) {
      res.status(404).json({
        success: false,
        error: 'Group not found',
      } as ApiResponse<null>);
      return;
    }

    const members = await userManagementService.getGroupMembers(parseInt(groupId));
    const permissions = await userManagementService.getGroupPermissions(parseInt(groupId));

    res.json({
      success: true,
      data: {
        ...group,
        members,
        permissions,
      },
    } as ApiResponse<any>);
  } catch (error) {
    logger.error({ err: error }, 'Error getting group');
    res.status(500).json({
      success: false,
      error: 'Failed to get group',
    } as ApiResponse<null>);
  }
}

export async function createGroup(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, customer_id } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Group name is required',
      } as ApiResponse<null>);
      return;
    }

    const group = await userManagementService.createGroup(
      name,
      description,
      customer_id,
      req.user?.id
    );

    await logFromRequest(req, 'create', 'user_group', group.id.toString(), undefined, { name, customer_id });

    res.status(201).json({
      success: true,
      data: group,
      message: 'Group created successfully',
    } as ApiResponse<typeof group>);
  } catch (error) {
    logger.error({ err: error }, 'Error creating group');
    res.status(500).json({
      success: false,
      error: 'Failed to create group',
    } as ApiResponse<null>);
  }
}

export async function updateGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    const group = await userManagementService.updateGroup(parseInt(groupId), name, description);

    await logFromRequest(req, 'update', 'user_group', groupId, undefined, { name, description });

    res.json({
      success: true,
      data: group,
      message: 'Group updated successfully',
    } as ApiResponse<typeof group>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating group');
    res.status(500).json({
      success: false,
      error: 'Failed to update group',
    } as ApiResponse<null>);
  }
}

export async function deleteGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;

    await userManagementService.deleteGroup(parseInt(groupId));
    await logFromRequest(req, 'delete', 'user_group', groupId);

    res.json({
      success: true,
      message: 'Group deleted successfully',
    } as ApiResponse<null>);
  } catch (error) {
    logger.error({ err: error }, 'Error deleting group');
    res.status(500).json({
      success: false,
      error: 'Failed to delete group',
    } as ApiResponse<null>);
  }
}

export async function updateGroupMembers(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const { add, remove } = req.body;

    if (add && Array.isArray(add)) {
      for (const userId of add) {
        await userManagementService.addUserToGroup(parseInt(groupId), userId, req.user?.id);
      }
    }

    if (remove && Array.isArray(remove)) {
      for (const userId of remove) {
        await userManagementService.removeUserFromGroup(parseInt(groupId), userId);
      }
    }

    await logFromRequest(req, 'update_members', 'user_group', groupId, undefined, { add, remove });

    const members = await userManagementService.getGroupMembers(parseInt(groupId));

    res.json({
      success: true,
      data: members,
      message: 'Group members updated successfully',
    } as ApiResponse<typeof members>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating group members');
    res.status(500).json({
      success: false,
      error: 'Failed to update group members',
    } as ApiResponse<null>);
  }
}

export async function updateGroupPermissions(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        error: 'Permissions must be an array of permission codes',
      } as ApiResponse<null>);
      return;
    }

    await userManagementService.setGroupPermissions(parseInt(groupId), permissions);
    await logFromRequest(req, 'update_permissions', 'user_group', groupId, undefined, { permissions });

    const groupPermissions = await userManagementService.getGroupPermissions(parseInt(groupId));

    res.json({
      success: true,
      data: groupPermissions,
      message: 'Group permissions updated successfully',
    } as ApiResponse<typeof groupPermissions>);
  } catch (error) {
    logger.error({ err: error }, 'Error updating group permissions');
    res.status(500).json({
      success: false,
      error: 'Failed to update group permissions',
    } as ApiResponse<null>);
  }
}

// =============================================================================
// CUSTOMER PORTAL
// =============================================================================

export async function getCustomerUsers(req: Request, res: Response): Promise<void> {
  try {
    const { customerId } = req.params;
    const users = await userManagementService.getCustomerUsers(customerId);

    res.json({
      success: true,
      data: users,
    } as ApiResponse<typeof users>);
  } catch (error) {
    logger.error({ err: error }, 'Error getting customer users');
    res.status(500).json({
      success: false,
      error: 'Failed to get customer users',
    } as ApiResponse<null>);
  }
}

export async function assignUserToCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const { customer_id } = req.body;

    const user = await userManagementService.assignUserToCustomer(userId, customer_id);

    await logFromRequest(req, 'assign_customer', 'user', userId, undefined, { customer_id });

    res.json({
      success: true,
      data: user,
      message: customer_id
        ? 'User assigned to customer successfully'
        : 'User removed from customer successfully',
    } as ApiResponse<typeof user>);
  } catch (error) {
    logger.error({ err: error }, 'Error assigning user to customer');
    res.status(500).json({
      success: false,
      error: 'Failed to assign user to customer',
    } as ApiResponse<null>);
  }
}

export default {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updatePassword,
  deactivateUser,
  activateUser,
  listPermissions,
  getUserPermissions,
  updateUserPermissions,
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  updateGroupMembers,
  updateGroupPermissions,
  getCustomerUsers,
  assignUserToCustomer,
};
