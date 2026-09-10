const express = require('express');
const controller = require('../controllers/assistantController');
const { authenticate, requireTeacher } = require('../middleware/auth');
const { validate, validateObjectId } = require('../middleware/validate');
const { paginationQuery } = require('../validators/common');
const {
  createAssistantSchema,
  updateAssistantSchema,
  setAssistantStatusSchema,
} = require('../validators/userValidators');

const router = express.Router();

// Assistant management belongs to the platform owner alone.
router.use(authenticate, requireTeacher);

router.get('/permissions', controller.listPermissions);
router.get('/', validate({ query: paginationQuery }), controller.listAssistants);
router.post('/', validate({ body: createAssistantSchema }), controller.createAssistant);

router.get('/:id', validateObjectId(), controller.getAssistant);
router.put(
  '/:id',
  validateObjectId(),
  validate({ body: updateAssistantSchema }),
  controller.updateAssistant
);
router.patch(
  '/:id/status',
  validateObjectId(),
  validate({ body: setAssistantStatusSchema }),
  controller.setAssistantStatus
);
router.delete('/:id', validateObjectId(), controller.deleteAssistant);

module.exports = router;
