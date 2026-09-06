import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('MAIL_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('MAIL_PORT', 587),
      secure: this.config.get('MAIL_SECURE', 'false') === 'true',
      auth: { user: this.config.get('MAIL_USER'), pass: this.config.get('MAIL_PASS') },
    });
  }

  async sendWelcomeEmail(to: string, firstName: string, password: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F131B; color: #EEF0F5; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #E7C27D; font-size: 28px; margin: 0;">SmartConnect</h1>
          <p style="color: #7FE0CB; margin: 4px 0; font-size: 16px;">Gusto Club</p>
        </div>
        <h2 style="color: #EEF0F5;">Bienvenue, ${firstName} !</h2>
        <p style="color: #C4C9D6;">Votre compte SmartConnect Gusto Club a été créé avec succès.</p>
        <div style="background: #1B2130; border: 1px solid #E7C27D30; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #8991A6; font-size: 13px;">VOS IDENTIFIANTS DE CONNEXION</p>
          <p style="margin: 4px 0; color: #EEF0F5;">📧 Email : <strong style="color: #E7C27D;">${to}</strong></p>
          <p style="margin: 4px 0; color: #EEF0F5;">🔐 Mot de passe : <strong style="color: #E7C27D;">${password}</strong></p>
        </div>
        <p style="color: #C4C9D6;">Pour des raisons de sécurité, merci de changer votre mot de passe lors de votre première connexion.</p>
        <div style="text-align: center; margin-top: 32px;">
          <a href="http://localhost:5173/login" style="background: #E7C27D; color: #0A0D13; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Se connecter</a>
        </div>
        <hr style="border-color: #242B3D; margin: 32px 0;">
        <p style="color: #5A6178; font-size: 12px; text-align: center;">SmartConnect Gusto Club — Tunis, Tunisie</p>
      </div>`;
    try {
      await this.transporter.sendMail({ from: this.config.get('MAIL_FROM', 'noreply@gustoclub.tn'), to, subject: 'Bienvenue sur SmartConnect Gusto Club', html });
      this.logger.log(`Welcome email sent to ${to}`);
    } catch (err) { this.logger.warn(`Failed to send welcome email to ${to}: ${err.message}`); }
  }

  async sendPasswordResetEmail(to: string, firstName: string, resetToken: string) {
    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F131B; color: #EEF0F5; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #E7C27D;">SmartConnect Gusto Club</h1>
        </div>
        <h2 style="color: #EEF0F5;">Réinitialisation du mot de passe</h2>
        <p style="color: #C4C9D6;">Bonjour ${firstName}, vous avez demandé une réinitialisation de votre mot de passe.</p>
        <p style="color: #C4C9D6;">Ce lien est valable pendant <strong style="color: #E7C27D;">1 heure</strong>.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background: #E7C27D; color: #0A0D13; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Réinitialiser mon mot de passe</a>
        </div>
        <p style="color: #8991A6; font-size: 13px;">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        <hr style="border-color: #242B3D; margin: 32px 0;">
        <p style="color: #5A6178; font-size: 12px; text-align: center;">SmartConnect Gusto Club — Tunis, Tunisie</p>
      </div>`;
    try {
      await this.transporter.sendMail({ from: this.config.get('MAIL_FROM', 'noreply@gustoclub.tn'), to, subject: '🔐 Réinitialisation de votre mot de passe', html });
      this.logger.log(`Reset email sent to ${to}`);
    } catch (err) { this.logger.warn(`Failed to send reset email to ${to}: ${err.message}`); }
  }

  async sendInvoiceEmail(to: string, clientName: string, orderRef: string, invoiceHtml: string) {
    try {
      await this.transporter.sendMail({ from: this.config.get('MAIL_FROM', 'noreply@gustoclub.tn'), to, subject: `🧾 Facture ${orderRef} — Gusto Club`, html: invoiceHtml });
      this.logger.log(`Invoice email sent to ${to} for order ${orderRef}`);
    } catch (err) { this.logger.warn(`Failed to send invoice to ${to}: ${err.message}`); }
  }

  async sendStockAlert(to: string[], data: { commercialName: string; productName: string; quantity: number; minThreshold: number }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F131B; color: #EEF0F5; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #E7C27D; font-size: 24px; margin: 0;">SmartConnect Gusto Club</h1>
        </div>
        <h2 style="color: #EEF0F5;">Alerte stock faible</h2>
        <p style="color: #C4C9D6;">Le stock assigné à <strong style="color: #E7C27D;">${data.commercialName}</strong> pour le produit <strong style="color: #E7C27D;">${data.productName}</strong> est passé sous le seuil d'alerte.</p>
        <div style="background: #1B2130; border: 1px solid #E7C27D30; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 4px 0; color: #EEF0F5;">Quantité restante : <strong style="color: #E7C27D;">${data.quantity}</strong></p>
          <p style="margin: 4px 0; color: #EEF0F5;">Seuil d'alerte : <strong>${data.minThreshold}</strong></p>
        </div>
        <p style="color: #C4C9D6;">Merci de planifier un réapprovisionnement.</p>
        <hr style="border-color: #242B3D; margin: 32px 0;">
        <p style="color: #5A6178; font-size: 12px; text-align: center;">SmartConnect Gusto Club — Tunis, Tunisie</p>
      </div>`;
    try {
      await this.transporter.sendMail({ from: this.config.get('MAIL_FROM', 'noreply@gustoclub.tn'), to: to.join(','), subject: `Alerte stock faible — ${data.productName}`, html });
      this.logger.log(`Stock alert email sent to ${to.join(',')}`);
    } catch (err) { this.logger.warn(`Failed to send stock alert: ${err.message}`); }
  }
}
