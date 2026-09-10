const express = require('express');
const controller = require('../controllers/groupController');
const { authenticate, requireStaff } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validate, validateObjectId } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/constants');
const {
  createGroupSchema,
  updateGroupSchema,
  changeMembersSchema,
} = require('../validators/groupValidators');

const router = express.Router();

// Groups decide who sees what, so they sit behind the student permission.
router.use(authenticate, requireStaff, requirePermission(PERMISSIONS.VIEW_STUDENTS));

router.get('/', controller.listGroups);
router.get('/:id', validateObjectId(), controller.getGroup);

router.post(
  '/',
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validate({ body: createGroupSchema }),
  controller.createGroup
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: updateGroupSchema }),
  controller.updateGroup
);

router.patch(
  '/:id/students',
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  validate({ body: changeMembersSchema }),
  controller.changeMembers
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.MANAGE_CONTENT),
  validateObjectId(),
  controller.deleteGroup
);

module.exports = router;
