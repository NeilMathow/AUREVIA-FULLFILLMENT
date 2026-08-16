'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const STATUS_LABELS = {
  pending: 'Order',
  shipped: 'Shipped',
};

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  // form state
  const [person, setPerson] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ peptide: '', units: '' }]);
  const [labelFile, setLabelFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      setOrders(data);
      setError(null);
    }
    setLoading(false);
  }

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  }

  function addItemRow() {
    setItems((prev) => [...prev, { peptide: '', units: '' }]);
  }

  function removeItemRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
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

    let shipping_label_url = null;
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

    const { error } = await supabase.from('orders').insert({
      person: person.trim(),
      notes: notes.trim() || null,
      items: cleanItems,
      status: 'pending',
      shipping_label_url,
    });
    setSubmitting(false);

    if (error) {
      alert('Could not save order: ' + error.message);
      return;
    }

    // reset form
    setPerson('');
    setNotes('');
    setItems([{ peptide: '', units: '' }]);
    setLabelFile(null);
    fetchOrders();
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) {
      alert('Could not update status: ' + error.message);
      return;
    }
    fetchOrders();
  }

  async function deleteOrder(id) {
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
        <div className="brand">
          <div className="brand-mark">
            <img src="/aurevia-mark.webp" alt="Aurevia" />
          </div>
          <div className="brand-text">
            <h1>Fulfillment Dashboard</h1>
            <span>{loading ? 'Loading orders…' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}</span>
          </div>
        </div>

        <div className="filter-tabs">
          {['all', 'pending', 'shipped'].map((f) => (
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
        {/* PLACE ORDER — full width */}
        <div className="panel panel-wide">
          <div className="panel-title">
            <span className="dot" /> Place Order
          </div>

          <div className="form-grid">
            <div className="form-col">
              <label>Customer</label>
              <input
                type="text"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="e.g. PX1 or Max"
              />

              <label>Shipping Label</label>
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
                  <span className="file-drop-placeholder">Click to upload PDF label</span>
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
                placeholder="e.g. Don't put an MG on label"
              />
            </div>

            <div className="form-col">
              <div className="items-block items-block-tall">
                <label style={{ marginTop: 0 }}>Items</label>
                {items.map((item, i) => (
                  <div className="item-row" key={i}>
                    <input
                      type="text"
                      placeholder="Peptide (e.g. RETA 20MG)"
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

          <button className="btn-primary" onClick={submitOrder} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Order'}
          </button>
        </div>

        {/* ORDERS LIST — full width, below */}
        <div className="orders-col">
          {error && <div className="error-banner">Couldn&apos;t load orders: {error}</div>}

          {loading ? (
            <div className="loading">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              No {filter === 'all' ? '' : filter === 'pending' ? 'open ' : 'shipped '}orders yet.
            </div>
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
                    <span className="sub-label">Items</span>
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
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                  >
                    <option value="pending">Order</option>
                    <option value="shipped">Shipped</option>
                  </select>
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
