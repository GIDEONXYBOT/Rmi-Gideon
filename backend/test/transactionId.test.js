import { expect } from 'chai';
import { generateTransactionId, generateMigrationTransactionId } from '../utils/transactionId.js';

describe('Transaction ID Generation', () => {
  describe('generateTransactionId', () => {
    it('generates a unique transaction ID with correct format', () => {
      const userId = '507f1f77bcf86cd799439011';
      const date = '2025-12-14';
      
      const txId = generateTransactionId(userId, date);
      
      expect(txId).to.be.a('string');
      expect(txId).to.include(userId);
      expect(txId).to.include(date);
      expect(txId.split('_')).to.have.lengthOf(4);
    });

    it('generates different IDs for the same user and date', () => {
      const userId = '507f1f77bcf86cd799439011';
      const date = '2025-12-14';
      
      const txId1 = generateTransactionId(userId, date);
      const txId2 = generateTransactionId(userId, date);
      
      expect(txId1).to.not.equal(txId2);
    });

    it('generates different IDs for different users', () => {
      const userId1 = '507f1f77bcf86cd799439011';
      const userId2 = '507f1f77bcf86cd799439012';
      const date = '2025-12-14';
      
      const txId1 = generateTransactionId(userId1, date);
      const txId2 = generateTransactionId(userId2, date);
      
      expect(txId1).to.not.equal(txId2);
      expect(txId1).to.include(userId1);
      expect(txId2).to.include(userId2);
    });

    it('generates different IDs for different dates', () => {
      const userId = '507f1f77bcf86cd799439011';
      const date1 = '2025-12-14';
      const date2 = '2025-12-15';
      
      const txId1 = generateTransactionId(userId, date1);
      const txId2 = generateTransactionId(userId, date2);
      
      expect(txId1).to.not.equal(txId2);
      expect(txId1).to.include(date1);
      expect(txId2).to.include(date2);
    });
  });

  describe('generateMigrationTransactionId', () => {
    it('generates a migration transaction ID with correct format', () => {
      const userId = '507f1f77bcf86cd799439011';
      const date = '2025-12-14';
      const createdAt = new Date('2025-12-14T10:30:00Z');
      
      const txId = generateMigrationTransactionId(userId, date, createdAt);
      
      expect(txId).to.be.a('string');
      expect(txId).to.include(userId);
      expect(txId).to.include(date);
      expect(txId).to.include('MIGRATED');
      expect(txId.split('_')).to.have.lengthOf(4);
    });

    it('generates the same ID for the same inputs', () => {
      const userId = '507f1f77bcf86cd799439011';
      const date = '2025-12-14';
      const createdAt = new Date('2025-12-14T10:30:00Z');
      
      const txId1 = generateMigrationTransactionId(userId, date, createdAt);
      const txId2 = generateMigrationTransactionId(userId, date, createdAt);
      
      expect(txId1).to.equal(txId2);
    });

    it('uses current time if createdAt is null', () => {
      const userId = '507f1f77bcf86cd799439011';
      const date = '2025-12-14';
      
      const txId = generateMigrationTransactionId(userId, date, null);
      
      expect(txId).to.be.a('string');
      expect(txId).to.include(userId);
      expect(txId).to.include(date);
      expect(txId).to.include('MIGRATED');
    });
  });
});
