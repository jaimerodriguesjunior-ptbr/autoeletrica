-- =====================================================
-- Migration: Relatório de Scanner (PDF)
-- Data: 2026-02-22
-- =====================================================

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS scanner_pdf TEXT;
