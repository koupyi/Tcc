import { Router } from 'express';
import { AddressController } from '../controllers/address.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { createAddressSchema, updateAddressSchema } from '../validators/address.validator';

const router = Router();
const controller = new AddressController();

router.use(authenticate);

router.get('/', (req, res, next) => controller.list(req, res, next));
router.post('/', validate(createAddressSchema), (req, res, next) => controller.create(req, res, next));
router.patch('/:id', validate(updateAddressSchema), (req, res, next) => controller.update(req, res, next));
router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

export default router;
