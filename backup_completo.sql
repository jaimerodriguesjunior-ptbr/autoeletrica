-- Script de Backup Gerado Automaticamente
-- Data: 2026-02-21T12:59:29.764Z
-- Este script cria cópias de todas as tabelas públicas do seu banco de dados.

-- Backup da tabela: clients
CREATE TABLE backup_clients_antes_migracao AS SELECT * FROM clients;

-- Backup da tabela: company_settings
CREATE TABLE backup_company_settings_antes_migracao AS SELECT * FROM company_settings;

-- Backup da tabela: fiscal_invoices
CREATE TABLE backup_fiscal_invoices_antes_migracao AS SELECT * FROM fiscal_invoices;

-- Backup da tabela: organizations
CREATE TABLE backup_organizations_antes_migracao AS SELECT * FROM organizations;

-- Backup da tabela: products
CREATE TABLE backup_products_antes_migracao AS SELECT * FROM products;

-- Backup da tabela: profiles
CREATE TABLE backup_profiles_antes_migracao AS SELECT * FROM profiles;

-- Backup da tabela: services
CREATE TABLE backup_services_antes_migracao AS SELECT * FROM services;

-- Backup da tabela: transactions
CREATE TABLE backup_transactions_antes_migracao AS SELECT * FROM transactions;

-- Backup da tabela: vehicles
CREATE TABLE backup_vehicles_antes_migracao AS SELECT * FROM vehicles;

-- Backup da tabela: work_order_items
CREATE TABLE backup_work_order_items_antes_migracao AS SELECT * FROM work_order_items;

-- Backup da tabela: work_orders
CREATE TABLE backup_work_orders_antes_migracao AS SELECT * FROM work_orders;

-- Backup finalizado.
