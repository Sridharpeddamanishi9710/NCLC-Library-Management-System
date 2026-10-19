const express = require('express');
const router = express.Router();
const MemberController = require('../controllers/memberController');
const {
  validateId,
  validateCreateMember,
  validateUpdateMember,
} = require('../middlewares/validate');

// Members CRUD routes
router.get('/', MemberController.getAllMembers);
router.post('/', validateCreateMember, MemberController.createMember);
router.get('/:id', validateId, MemberController.getMemberById);
router.put('/:id', validateId, validateUpdateMember, MemberController.updateMember);
router.delete('/:id', validateId, MemberController.deleteMember);

module.exports = router;
