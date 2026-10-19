const MemberModel = require('../models/memberModel');

/**
 * Controller for Member management operations.
 */
class MemberController {
  /**
   * GET /api/members
   * List members with search and status filtering.
   */
  static getAllMembers(req, res, next) {
    try {
      const { search, status } = req.query;

      const members = MemberModel.findAll({ search, status });

      res.json({
        success: true,
        count: members.length,
        data: members,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/members/:id
   * Retrieve a member by ID.
   */
  static getMemberById(req, res, next) {
    try {
      const id = req.validatedId;
      const member = MemberModel.findById(id);

      if (!member) {
        return res.status(404).json({
          success: false,
          error: 'Member not found.',
        });
      }

      res.json({
        success: true,
        data: member,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/members
   * Register a new library member.
   */
  static createMember(req, res, next) {
    try {
      const { member_code, name, email, phone, status, max_borrow_limit } = req.body;

      // Duplicate code check
      const codeExists = MemberModel.findByCode(member_code);
      if (codeExists) {
        return res.status(409).json({
          success: false,
          error: 'A member with this member code already exists.',
        });
      }

      // Duplicate email check
      const emailExists = MemberModel.findByEmail(email);
      if (emailExists) {
        return res.status(409).json({
          success: false,
          error: 'A member with this email address already exists.',
        });
      }

      const limit = max_borrow_limit !== undefined ? Number(max_borrow_limit) : 3;

      const newMember = MemberModel.create({
        member_code,
        name,
        email,
        phone,
        status: status ? status.toUpperCase() : 'ACTIVE',
        max_borrow_limit: limit,
      });

      res.status(201).json({
        success: true,
        message: 'Member registered successfully.',
        data: newMember,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/members/:id
   * Update an existing member.
   */
  static updateMember(req, res, next) {
    try {
      const id = req.validatedId;
      const existing = MemberModel.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Member not found.',
        });
      }

      const { member_code, name, email, phone, status, max_borrow_limit } = req.body;
      const updates = {};

      if (member_code !== undefined) {
        const duplicate = MemberModel.findByCode(member_code, id);
        if (duplicate) {
          return res.status(409).json({
            success: false,
            error: 'A member with this member code already exists.',
          });
        }
        updates.member_code = member_code;
      }

      if (email !== undefined) {
        const duplicate = MemberModel.findByEmail(email, id);
        if (duplicate) {
          return res.status(409).json({
            success: false,
            error: 'A member with this email address already exists.',
          });
        }
        updates.email = email;
      }

      if (name !== undefined) updates.name = name;
      if (phone !== undefined) updates.phone = phone;
      if (status !== undefined) updates.status = status.toUpperCase();
      if (max_borrow_limit !== undefined) updates.max_borrow_limit = Number(max_borrow_limit);

      const updated = MemberModel.update(id, updates);

      res.json({
        success: true,
        message: 'Member updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/members/:id
   * Deactivates member or deletes if no active loans exist.
   */
  static deleteMember(req, res, next) {
    try {
      const id = req.validatedId;
      const existing = MemberModel.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Member not found.',
        });
      }

      const activeLoans = MemberModel.getActiveLoansCount(id);
      if (activeLoans > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot deactivate or delete member with active loans. ${activeLoans} book(s) are currently borrowed and must be returned first.`,
        });
      }

      const { action } = req.query;
      const totalLoans = MemberModel.getTotalLoansCount(id);

      // If explicit deactivation requested or member has past loan history, deactivate safely
      if (action === 'deactivate' || totalLoans > 0) {
        const deactivated = MemberModel.deactivate(id);
        return res.json({
          success: true,
          message: totalLoans > 0
            ? 'Member has past borrowing history and was deactivated successfully.'
            : 'Member deactivated successfully.',
          data: deactivated,
        });
      }

      // If no past loan history exists at all, delete record completely
      MemberModel.delete(id);

      res.json({
        success: true,
        message: 'Member deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = MemberController;
