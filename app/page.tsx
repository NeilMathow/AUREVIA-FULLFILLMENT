'use client';

import { useEffect, useState } from 'react';
import { supabase, Order, OrderItem } from '@/lib/supabase';

type Status = 'pending' | 'shipped';
type Filter = 'all' | Status;

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Order',
  shipped: 'Shipped',
};

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // form state
  const [person, setPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ peptide: '', units: '' }]);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingLabelUrl, setExistingLabelUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    // Realtime: coworkers see new orders / status changes live
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setOrders(data as Order[]);
      setError(null);
    }
    setLoading(false);
  }

  function updateItem(index: number, field: keyof OrderItem, value: string) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  }

  function addItemRow() {
    setItems((prev) => [...prev, { peptide: '', units: '' }]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function startEdit(order: Order) {
    setEditingId(order.id);
    setPerson(order.person);
    setNotes(order.notes || '');
    setItems(order.items.length ? order.items : [{ peptide: '', units: '' }]);
    setExistingLabelUrl(order.shipping_label_url || null);
    setLabelFile(null);
    setFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setPerson('');
    setNotes('');
    setItems([{ peptide: '', units: '' }]);
    setLabelFile(null);
    setExistingLabelUrl(null);
  }

  async function submitOrder() {
    if (!person.trim()) {
      alert('Please enter a person / customer name.');
      return;
    }
    const cleanItems = items.filter((it) => it.peptide.trim() || it.units.trim());
    if (cleanItems.length === 0) {
      alert('Please add at least one item.');
      return;
    }

    setSubmitting(true);

    let shipping_label_url: string | null = existingLabelUrl;
    if (labelFile) {
      const fileName = `${Date.now()}-${labelFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('shipping-labels')
        .upload(fileName, labelFile, { contentType: 'application/pdf' });

      if (uploadError) {
        setSubmitting(false);
        alert('Could not upload shipping label: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('shipping-labels')
        .getPublicUrl(fileName);
      shipping_label_url = publicUrlData.publicUrl;
    }

    const payload = {
      person: person.trim(),
      notes: notes.trim() || null,
      items: cleanItems,
      shipping_label_url,
    };

    const { error } = editingId
      ? await supabase.from('orders').update(payload).eq('id', editingId)
      : await supabase.from('orders').insert({ ...payload, status: 'pending' });
    setSubmitting(false);

    if (error) {
      alert('Could not save order: ' + error.message);
      return;
    }

    // reset form
    setEditingId(null);
    setPerson('');
    setNotes('');
    setItems([{ peptide: '', units: '' }]);
    setLabelFile(null);
    setExistingLabelUrl(null);
    fetchOrders();
  }

  async function updateStatus(id: string, status: Status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) {
      alert('Could not update status: ' + error.message);
      return;
    }
    fetchOrders();
  }

  async function deleteOrder(id: string) {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      alert('Could not delete order: ' + error.message);
      return;
    }
    fetchOrders();
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className="topbar">
        <div className="brand" onClick={() => setFilter('all')} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">
            <img src="/aurevia-mark.gif" alt="Aurevia logo" />
          </div>
          <div className="brand-text">
            <h1>Fulfillment Dashboard</h1>
            <span>{loading ? 'Loading orders…' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}</span>
          </div>
        </div>

        <div className="filter-tabs">
          {(['all', 'pending', 'shipped'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Orders' : 'Shipped'}
            </button>
          ))}
        </div>

      </div>

      <div className="page">
        {/* PLACE ORDER — full width, only on the All tab */}
        {filter === 'all' && (
        <div className="panel panel-wide">
          <div className="panel-title">
            <span className="dot" /> {editingId ? 'Edit Order' : 'Place Order'}
          </div>

          <div className="form-grid">
            <div className="form-col">
              <label>Customer</label>
              <input
                type="text"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="Customer"
              />

              <label>Shipping Label</label>
              {existingLabelUrl && !labelFile && (
                <div className="side-block" style={{ marginBottom: 8 }}>
                  <a
                    href={existingLabelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label-link"
                  >
                    📄 Current label — view
                  </a>
                </div>
              )}
              <label className="file-drop" htmlFor="labelUpload">
                <input
                  id="labelUpload"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setLabelFile(e.target.files?.[0] || null)}
                  hidden
                />
                {labelFile ? (
                  <span className="file-drop-name">📄 {labelFile.name}</span>
                ) : (
                  <span className="file-drop-placeholder">
                    {existingLabelUrl ? 'Click to replace PDF label' : 'Click to upload PDF label'}
                  </span>
                )}
              </label>
              {labelFile && (
                <button
                  type="button"
                  className="btn-small file-remove"
                  onClick={() => setLabelFile(null)}
                >
                  Remove
                </button>
              )}

              <label>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
              />
            </div>

            <div className="form-col">
              <div className="items-block items-block-tall">
                <label style={{ marginTop: 0 }}>Peptides</label>
                {items.map((item, i) => (
                  <div className="item-row" key={i}>
                    <input
                      type="text"
                      placeholder="Peptide"
                      value={item.peptide}
                      onChange={(e) => updateItem(i, 'peptide', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Units"
                      value={item.units}
                      onChange={(e) => updateItem(i, 'units', e.target.value)}
                    />
                    <button className="remove-item" onClick={() => removeItemRow(i)}>
                      ✕
                    </button>
                  </div>
                ))}
                <button className="add-item-btn" onClick={addItemRow}>
                  + Add item
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={submitOrder} disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add Order'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-small"
                style={{ padding: '11px 18px' }}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        )}

        {/* ORDERS LIST — full width, below */}
        <div className="orders-col">
          {error && <div className="error-banner">Couldn&apos;t load orders: {error}</div>}

          {loading ? (
            <div className="loading">Loading orders…</div>
          ) : filtered.length === 0 ? (
            filter === 'all' ? null : (
              <div className="empty-state">
                No {filter === 'pending' ? 'open ' : 'shipped '}orders yet.
              </div>
            )
          ) : (
            filtered.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-top">
                  <div>
                    <div className="order-person">{order.person}</div>
                    <div className="order-meta">
                      {new Date(order.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <span className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                </div>

                <div className="order-grid">
                  <div>
                    <table className="items-table">
                      <thead>
                        <tr>
                          <th>Peptide</th>
                          <th>Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((it, i) => (
                          <tr key={i}>
                            <td>{it.peptide || '—'}</td>
                            <td>{it.units || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    {order.shipping_label_url && (
                      <div className="side-block">
                        <span className="sub-label">Shipping Label</span>
                        <a
                          href={order.shipping_label_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="label-link"
                        >
                          📄 View / Print Label
                        </a>
                      </div>
                    )}
                    {order.notes && (
                      <div className="side-block">
                        <span className="sub-label">Notes</span>
                        <div className="notes-text">{order.notes}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="order-actions">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value as Status)}
                  >
                    <option value="pending">Order</option>
                    <option value="shipped">Shipped</option>
                  </select>
                  {order.status !== 'shipped' && (
                    <button className="btn-small btn-edit" onClick={() => startEdit(order)}>
                      Edit
                    </button>
                  )}
                  <button className="btn-small" onClick={() => deleteOrder(order.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
