import { QuickCommand } from "@/components/app/quick-command";
import { LiveRecordList } from "@/components/app/live-record-list";
import { SearchableSelect } from "@/components/app/searchable-select";
import { WorkflowFormFields } from "@/components/app/workflow-form-fields";
import { CustomerCatalogueForm } from "@/components/app/customer-catalogue-form";

const items = ["Ken Mwangangi", "Kennedy", "Karen", "Ahmed", "Mike Ken"].map((name, index) => ({ id: String(index), name, terms: [`CUS-${index}`, `0700${index}`], content: <article>{name}</article> }));

export default function SearchPerformanceFixture() {
  return <><QuickCommand /><LiveRecordList items={items} label="Search customers" header={<p>Customers</p>} />
    <form aria-label="report"><SearchableSelect name="customerId" label="Report customer" allLabel="All customers" options={items.map((item) => ({ id: item.id, label: item.name }))} /></form>
    <form aria-label="workflow"><WorkflowFormFields fields={["Customer", "Supplier", "Product", "Quantity", "Unit price", "Total"]}
      customers={items.map((item) => ({ id: item.id, name: item.name, code: `CUS-${item.id}`, phone: "0700000000", balance: 0 }))}
      suppliers={[{ id: "s1", name: "Kenya Supplier", code: "SUP-1", phone: "0700000001", type: "manufacturer" }, { id: "s2", name: "Coca Cola", code: "SUP-2", phone: "0700000002", type: "manufacturer" }]}
      products={Array.from({ length: 300 }, (_, index) => ({ id: `p${index}`, name: `Product ${index}`, code: `SKU-${index}`, price: 950, available: 100, vatRate: 16, vatCode: "VAT_STD", trackInventory: true }))} /></form>
    <section aria-label="catalogue"><CustomerCatalogueForm customers={[{ id: "c1", customer_name: "Ken", customer_code: "CUS-1", phone: "0700000000" }]}
      products={["Coke 1Lt", "Fanta 2Lt", "Aquamist 500ml"].map((name, index) => ({ id: `p${index}`, product_name: name, product_code: `SKU-${index}`, sku: `SKU-${index}`, default_selling_price_placeholder: 950, vat_status: "VAT_STD", tax_category: "standard", image_path: null, active: true }))} /></section></>;
}
