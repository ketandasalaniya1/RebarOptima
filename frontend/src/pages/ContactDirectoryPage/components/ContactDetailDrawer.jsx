import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageCircle,
  Copy,
  Check,
  Mail,
  Building2,
  Lock,
  Globe,
  MapPin,
  Calendar,
  User,
  Star,
  Edit2,
  Archive,
  RotateCcw,
  Trash2,
  Clock,
  Tag,
  ExternalLink,
  ShieldCheck,
  Building,
} from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import { contactsApi } from '../../../utils/contactsApi';

export default function ContactDetailDrawer({
  isOpen,
  onClose,
  contactId,
  onEdit,
  onToggleFavourite,
  onArchive,
  onRestore,
  onDelete,
  onSelectProject,
}) {
  const [contact, setContact] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    if (!isOpen || !contactId) {
      setContact(null);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        setError('');
        const res = await contactsApi.getContactById(contactId);
        if (isMounted) setContact(res);
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load contact details');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, contactId]);

  const handleCopy = async (num, idx) => {
    try {
      await navigator.clipboard.writeText(num);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (_) {}
  };

  const handleWhatsApp = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return;
    const cleanNumber = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${cleanNumber}?text=Hello%20${encodeURIComponent(contact?.name || '')}`, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={contact?.name || 'Contact Details'}
      subtitle={contact ? `${contact.categoryName || 'Contact'} • ${contact.companyName || 'Company'}` : 'Loading…'}
      icon={<User size={18} />}
      width="520px"
      footer={
        contact && (
          <div className="ro-drawer-footer-actions">
            <button
              type="button"
              className="ro-btn ro-btn--secondary"
              onClick={() => {
                onClose();
                onEdit(contact);
              }}
            >
              <Edit2 size={14} />
              <span>Edit Contact</span>
            </button>

            {contact.isArchived ? (
              <button
                type="button"
                className="ro-btn ro-btn--secondary"
                onClick={() => {
                  onRestore(contact.id || contact._id);
                  onClose();
                }}
              >
                <RotateCcw size={14} />
                <span>Restore</span>
              </button>
            ) : (
              <button
                type="button"
                className="ro-btn ro-btn--secondary"
                onClick={() => {
                  onArchive(contact.id || contact._id);
                  onClose();
                }}
              >
                <Archive size={14} />
                <span>Archive</span>
              </button>
            )}

            <button
              type="button"
              className="ro-btn ro-btn--danger"
              onClick={() => {
                onDelete(contact.id || contact._id);
                onClose();
              }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        )
      }
    >
      {isLoading ? (
        <div className="ro-drawer-loading">
          <div className="ro-spinner" />
          <span>Loading contact profile…</span>
        </div>
      ) : error ? (
        <div className="ro-drawer-error">
          <span>{error}</span>
        </div>
      ) : contact ? (
        <div className="ro-contact-detail-body">
          {/* Profile Header Card */}
          <div className="ro-detail-hero">
            <div className="ro-detail-avatar">
              {contact.avatar ? (
                <img src={contact.avatar} alt={contact.name} />
              ) : (
                <div className="ro-detail-initials">
                  {(contact.name?.[0] || 'C').toUpperCase()}
                </div>
              )}
            </div>

            <div className="ro-detail-hero-info">
              <div className="ro-detail-name-row">
                <h2>{contact.name}</h2>
                <button
                  type="button"
                  className={`ro-btn-detail-fav ${contact.isFavourite ? 'active' : ''}`}
                  onClick={() => {
                    onToggleFavourite(contact.id || contact._id);
                    setContact((prev) => (prev ? { ...prev, isFavourite: !prev.isFavourite } : prev));
                  }}
                  title={contact.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <Star size={18} fill={contact.isFavourite ? '#f59e0b' : 'none'} color={contact.isFavourite ? '#f59e0b' : 'currentColor'} />
                </button>
              </div>

              <div className="ro-detail-sub-row">
                <span className="ro-category-pill">{contact.categoryName || 'Other'}</span>
                {contact.visibility === 'private' ? (
                  <span className="ro-badge-private">
                    <Lock size={11} />
                    <span>Private</span>
                  </span>
                ) : (
                  <span className="ro-badge-shared">Shared with Company</span>
                )}
              </div>

              {(contact.designation || contact.companyName) && (
                <div className="ro-detail-org-text">
                  {contact.designation && <strong>{contact.designation}</strong>}
                  {contact.designation && contact.companyName && <span> at </span>}
                  {contact.companyName && <span>{contact.companyName}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Quick Primary Actions */}
          {contact.primaryPhone && (
            <div className="ro-detail-quick-dial-bar">
              <a href={`tel:${contact.primaryPhone}`} className="ro-btn-quick-call">
                <Phone size={15} />
                <span>Call {contact.primaryPhone}</span>
              </a>

              <button
                type="button"
                className="ro-btn-quick-wa"
                onClick={() => handleWhatsApp(contact.primaryPhone)}
                title="Open WhatsApp"
              >
                <MessageCircle size={16} />
                <span>WhatsApp</span>
              </button>
            </div>
          )}

          {/* Phone Numbers Section */}
          <div className="ro-detail-section">
            <h4 className="ro-detail-section-title">
              <Phone size={14} />
              <span>Phone Numbers ({contact.phones?.length || 0})</span>
            </h4>

            <div className="ro-detail-phones-list">
              {contact.phones && contact.phones.length > 0 ? (
                contact.phones.map((p, idx) => (
                  <div key={idx} className="ro-detail-phone-row">
                    <div className="ro-phone-info-col">
                      <div className="ro-phone-num-row">
                        <a href={`tel:${p.number}`} className="ro-phone-text">
                          {p.number}
                        </a>
                        {p.isPrimary && <span className="ro-primary-phone-tag">Primary</span>}
                        {p.hasWhatsApp && <span className="ro-wa-available-tag">WhatsApp</span>}
                      </div>
                      <span className="ro-phone-label-text">{p.label || 'Phone'}</span>
                    </div>

                    <div className="ro-phone-row-actions">
                      <button
                        type="button"
                        className="ro-btn-icon-subtle"
                        onClick={() => handleCopy(p.number, idx)}
                        title="Copy number"
                      >
                        {copiedIndex === idx ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                      </button>

                      {p.hasWhatsApp && (
                        <button
                          type="button"
                          className="ro-btn-icon-subtle ro-action-wa"
                          onClick={() => handleWhatsApp(p.number)}
                          title="WhatsApp"
                        >
                          <MessageCircle size={15} />
                        </button>
                      )}

                      <a href={`tel:${p.number}`} className="ro-btn-icon-subtle" title="Call">
                        <Phone size={14} />
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="ro-detail-empty-box">No phone numbers saved</div>
              )}
            </div>
          </div>

          {/* Email & Digital Details */}
          {(contact.email || contact.website) && (
            <div className="ro-detail-section">
              <h4 className="ro-detail-section-title">
                <Globe size={14} />
                <span>Digital & Communications</span>
              </h4>

              <div className="ro-detail-info-grid">
                {contact.email && (
                  <div className="ro-info-item">
                    <span className="ro-info-label">Email Address</span>
                    <a href={`mailto:${contact.email}`} className="ro-info-link">
                      <Mail size={13} />
                      <span>{contact.email}</span>
                    </a>
                  </div>
                )}

                {contact.website && (
                  <div className="ro-info-item">
                    <span className="ro-info-label">Website</span>
                    <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noreferrer" className="ro-info-link">
                      <Globe size={13} />
                      <span>{contact.website}</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Associated Projects Section */}
          <div className="ro-detail-section">
            <h4 className="ro-detail-section-title">
              <Building2 size={14} />
              <span>Associated Projects ({contact.projects?.length || 0})</span>
            </h4>

            {contact.projects && contact.projects.length > 0 ? (
              <div className="ro-detail-projects-grid">
                {contact.projects.map((proj) => (
                  <div key={proj.id} className="ro-detail-project-card">
                    <div className="ro-project-card-left">
                      <Building size={14} className="ro-proj-icon" />
                      <div>
                        <span className="ro-proj-name">{proj.name}</span>
                        <span className="ro-proj-status">{proj.status || 'Active'}</span>
                      </div>
                    </div>
                    {onSelectProject && (
                      <button
                        type="button"
                        className="ro-btn-switch-project"
                        onClick={() => {
                          onClose();
                          onSelectProject(proj.id);
                        }}
                        title={`Open ${proj.name} workspace`}
                      >
                        <span>Open Project</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ro-detail-empty-box">
                Company-wide contact (Not tied to a specific project)
              </div>
            )}
          </div>

          {/* Address Section */}
          {contact.address && (contact.address.street || contact.address.city || contact.address.state || contact.address.pincode) && (
            <div className="ro-detail-section">
              <h4 className="ro-detail-section-title">
                <MapPin size={14} />
                <span>Physical Address</span>
              </h4>

              <div className="ro-detail-address-box">
                {contact.address.street && <div>{contact.address.street}</div>}
                <div>
                  {[contact.address.city, contact.address.state, contact.address.country, contact.address.pincode]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* Notes & Tags */}
          {(contact.notes || (contact.tags && contact.tags.length > 0)) && (
            <div className="ro-detail-section">
              <h4 className="ro-detail-section-title">
                <Tag size={14} />
                <span>Notes & Tags</span>
              </h4>

              {contact.notes && (
                <div className="ro-detail-notes-box">
                  <p>{contact.notes}</p>
                </div>
              )}

              {contact.tags && contact.tags.length > 0 && (
                <div className="ro-detail-tags-list">
                  {contact.tags.map((tag, idx) => (
                    <span key={idx} className="ro-tag-chip">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audit History Log */}
          {contact.activityLogs && contact.activityLogs.length > 0 && (
            <div className="ro-detail-section">
              <h4 className="ro-detail-section-title">
                <Clock size={14} />
                <span>Activity History</span>
              </h4>

              <div className="ro-detail-timeline">
                {contact.activityLogs.map((log) => (
                  <div key={log.id} className="ro-timeline-item">
                    <span className="ro-timeline-bullet" />
                    <div className="ro-timeline-content">
                      <div className="ro-timeline-title">
                        <strong>{log.action.replace(/_/g, ' ').toUpperCase()}</strong> by {log.performedByName}
                      </div>
                      <div className="ro-timeline-date">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

