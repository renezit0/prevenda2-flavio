import React from 'react';

const getInitial = (name) => {
  if (!name) return 'U';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts[0][0].toUpperCase();
};

const Avatar = ({ size = 40, user }) => {
  const avatarUrl = user?.avatar_url || user?.avatar || null;
  const initial = getInitial(user?.nome);

  return (
    <div
      className="avatar-container user-avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: '50%',
        backgroundColor: avatarUrl ? 'transparent' : 'var(--secondary-dark, #4f46e5)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '700',
        fontSize: `${size * 0.4}px`,
        overflow: 'hidden',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%'
          }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};

export default Avatar;
