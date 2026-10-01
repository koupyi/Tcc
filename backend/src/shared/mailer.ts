// Re-export mailer from its actual location
// The mailer is a utility/service, placed here for correct import resolution
export { sendMail } from '../middlewares/mailer';
