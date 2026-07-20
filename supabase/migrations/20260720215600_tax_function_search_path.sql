alter function public.prevent_tax_rule_overlap() set search_path = public, pg_temp;
alter function public.prevent_vat_code_overlap() set search_path = public, pg_temp;
alter function public.prevent_accepted_external_document_mutation() set search_path = public, pg_temp;
alter function public.prevent_closed_tax_period_mutation() set search_path = public, pg_temp;
alter function public.calculate_vat_amount(numeric, numeric, boolean, text) set search_path = public, pg_temp;
