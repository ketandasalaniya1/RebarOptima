import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  resolveUserAndCompany,
  assertProjectAccess,
  filterProjectsForUser,
  projectIdQuery,
  isPartnerAdminRole,
} from './project-access';

export function createProjectsRouter(getDb: () => any, authMiddleware: any, logAudit?: any) {
  const router = Router();

  const validateCoordinates = (lat: any, lng: any) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return 'Latitude must be a valid number between -90 and 90';
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return 'Longitude must be a valid number between -180 and 180';
    }
    return null;
  };

  const validatePincode = (pincode: any) => {
    if (!pincode || (typeof pincode !== 'string' && typeof pincode !== 'number')) {
      return 'Project Address Pincode is required';
    }
    const pinStr = String(pincode).trim();
    if (!/^[1-9][0-9]{5}$/.test(pinStr)) {
      return 'Project Address Pincode must be a valid Indian 6-digit PIN code';
    }
    return null;
  };

  const validateGeofences = (geofences: any[]) => {
    if (!Array.isArray(geofences)) return 'Geofences must be an array';
    for (const [idx, gf] of geofences.entries()) {
      if (!gf.name || !String(gf.name).trim()) {
        return `Geofence #${idx + 1}: Name is required`;
      }
      if (!['circle', 'polygon'].includes(gf.boundaryType)) {
        return `Geofence #${idx + 1}: Boundary type must be 'circle' or 'polygon'`;
      }
      if (gf.boundaryType === 'circle') {
        if (!gf.center) return `Geofence #${idx + 1}: Circle requires center coordinates`;
        const coordErr = validateCoordinates(gf.center.latitude, gf.center.longitude);
        if (coordErr) return `Geofence #${idx + 1}: ${coordErr}`;
        const radius = Number(gf.radius);
        if (isNaN(radius) || radius <= 0 || radius > 50000) {
          return `Geofence #${idx + 1}: Radius must be a positive number up to 50,000 meters`;
        }
      } else if (gf.boundaryType === 'polygon') {
        if (!Array.isArray(gf.coordinates) || gf.coordinates.length < 3) {
          return `Geofence #${idx + 1}: Polygon requires at least 3 coordinate points`;
        }
        for (const pt of gf.coordinates) {
          if (!Array.isArray(pt) || pt.length < 2) {
            return `Geofence #${idx + 1}: Polygon points must be [longitude, latitude]`;
          }
          const [lng, lat] = pt;
          const coordErr = validateCoordinates(lat, lng);
          if (coordErr) return `Geofence #${idx + 1}: ${coordErr}`;
        }
      }
    }
    return null;
  };

  const canCreateProjects = async (db: any, ctx: any) => {
    if (ctx.isDeveloper || ctx.isCompanyAdmin) return true;
    if (ctx.isPartnerAdmin || isPartnerAdminRole(ctx.role)) return false;
    if (!ctx.userDoc?.roleId) return false;
    try {
      const role = await db.collection('roles').findOne(
        ObjectId.isValid(String(ctx.userDoc.roleId)) && String(ctx.userDoc.roleId).length === 24
          ? { $or: [{ _id: new ObjectId(String(ctx.userDoc.roleId)) }, { _id: String(ctx.userDoc.roleId) }] }
          : { _id: String(ctx.userDoc.roleId) },
      );
      const perms = role?.permissions || {};
      const projects = perms.projects || perms.Projects;
      if (projects === true) return true;
      if (projects && typeof projects === 'object') {
        return projects.create === true || projects.create === undefined;
      }
      // Feature map style: projects.create
      if (perms['projects.create'] === true) return true;
    } catch (_) {}
    return false;
  };

  // 1. GET /api/projects
  router.get('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { status } = req.query;

      const base: any = {};
      if (status && ['active', 'inactive'].includes(String(status))) {
        base.status = String(status);
      }

      const query = filterProjectsForUser(ctx, base);
      const projects = await db.collection('projects').find(query).sort({ createdAt: -1 }).toArray();
      res.json(projects);
    } catch (e: any) {
      console.error('List projects error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // 2. GET /api/projects/:id
  router.get('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const project = await assertProjectAccess(db, ctx, req.params.id, { requireActive: false });
      res.json(project);
    } catch (e: any) {
      const status = e.status || 500;
      res.status(status).json({ message: e.message, code: e.code });
    }
  });

  // 3. POST /api/projects
  router.post('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);

      if (!(await canCreateProjects(db, ctx))) {
        return res.status(403).json({
          message: 'You are not authorized to create projects',
          code: 'PROJECT_CREATE_DENIED',
        });
      }

      const { name, address, pincode, location, projectType, geofences, assignedPartnerAdminIds } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ message: 'Project Name is required' });
      }
      if (!address || !String(address).trim()) {
        return res.status(400).json({ message: 'Project Address is required' });
      }

      const pinErr = validatePincode(pincode);
      if (pinErr) return res.status(400).json({ message: pinErr });

      if (!location || location.latitude === undefined || location.longitude === undefined) {
        return res.status(400).json({ message: 'Project Location coordinates (latitude, longitude) are required' });
      }
      const coordErr = validateCoordinates(location.latitude, location.longitude);
      if (coordErr) return res.status(400).json({ message: coordErr });

      const validTypes = ['Residential', 'Mixed-use', 'Commercial', 'Villa', 'Other'];
      if (!projectType || !validTypes.includes(projectType)) {
        return res.status(400).json({ message: `Project Type must be one of: ${validTypes.join(', ')}` });
      }

      if (geofences && geofences.length > 0) {
        const gfErr = validateGeofences(geofences);
        if (gfErr) return res.status(400).json({ message: gfErr });
      }

      const newId = new ObjectId();
      const now = new Date();

      const newProject = {
        _id: newId,
        id: newId.toString(),
        companyId: ctx.companyId,
        name: String(name).trim(),
        address: String(address).trim(),
        pincode: String(pincode).trim(),
        location: {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        },
        projectType,
        status: 'active',
        geofences: (geofences || []).map((g: any, idx: number) => ({
          ...g,
          id: g.id || `gf_${Date.now()}_${idx}`,
          isActive: g.isActive !== false,
          createdAt: now,
          updatedAt: now,
        })),
        assignedPartnerAdminIds: Array.isArray(assignedPartnerAdminIds) ? assignedPartnerAdminIds.map(String) : [],
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('projects').insertOne(newProject);

      if (Array.isArray(assignedPartnerAdminIds) && assignedPartnerAdminIds.length > 0) {
        for (const partnerId of assignedPartnerAdminIds) {
          const userQuery =
            ObjectId.isValid(partnerId) && partnerId.length === 24
              ? { $or: [{ _id: new ObjectId(partnerId) }, { _id: partnerId }] }
              : { _id: partnerId };
          await db.collection('users').updateOne(userQuery, {
            $addToSet: { assignedProjects: newId.toString() },
          });
        }
      }

      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          actorType: 'user',
          companyId: ctx.companyId,
          action: 'PROJECT_CREATED',
          resource: 'projects',
          resourceId: newId.toString(),
          projectId: newId.toString(),
          newValue: { name: newProject.name, projectType: newProject.projectType },
        });
      }

      res.status(201).json(newProject);
    } catch (e: any) {
      console.error('Create project error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  // 4. PUT /api/projects/:id
  router.put('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const existing = await assertProjectAccess(db, ctx, req.params.id, { requireActive: false });

      const { name, address, pincode, location, projectType, status } = req.body;
      const updateFields: any = { updatedAt: new Date(), updatedBy: ctx.userId };

      if (name !== undefined) {
        if (!name || !String(name).trim()) return res.status(400).json({ message: 'Project Name is required' });
        updateFields.name = String(name).trim();
      }
      if (address !== undefined) {
        if (!address || !String(address).trim()) return res.status(400).json({ message: 'Project Address is required' });
        updateFields.address = String(address).trim();
      }
      if (pincode !== undefined) {
        const pinErr = validatePincode(pincode);
        if (pinErr) return res.status(400).json({ message: pinErr });
        updateFields.pincode = String(pincode).trim();
      }
      if (location !== undefined) {
        const coordErr = validateCoordinates(location?.latitude, location?.longitude);
        if (coordErr) return res.status(400).json({ message: coordErr });
        updateFields.location = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        };
      }
      if (projectType !== undefined) {
        const validTypes = ['Residential', 'Mixed-use', 'Commercial', 'Villa', 'Other'];
        if (!validTypes.includes(projectType)) {
          return res.status(400).json({ message: `Project Type must be one of: ${validTypes.join(', ')}` });
        }
        updateFields.projectType = projectType;
      }
      if (status !== undefined) {
        if (!['active', 'inactive'].includes(status)) {
          return res.status(400).json({ message: 'Status must be "active" or "inactive"' });
        }
        if (ctx.isPartnerAdmin) {
          return res.status(403).json({ message: 'Project Partner Admins cannot change project lifecycle status' });
        }
        updateFields.status = status;
      }

      await db.collection('projects').updateOne({ _id: existing._id }, { $set: updateFields });
      const updated = await db.collection('projects').findOne({ _id: existing._id });

      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          actorType: 'user',
          companyId: ctx.companyId,
          action: 'PROJECT_UPDATED',
          resource: 'projects',
          resourceId: String(existing._id),
          projectId: String(existing._id),
          newValue: updateFields,
        });
      }

      res.json(updated);
    } catch (e: any) {
      const status = e.status || 500;
      res.status(status).json({ message: e.message, code: e.code });
    }
  });

  // 5. PUT /api/projects/:id/status
  router.put('/:id/status', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { status } = req.body;

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Status must be "active" or "inactive"' });
      }

      const existing = await assertProjectAccess(db, ctx, req.params.id, { requireActive: false });

      if (ctx.isPartnerAdmin) {
        return res.status(403).json({ message: 'Project Partner Admins cannot change project lifecycle status' });
      }

      await db.collection('projects').updateOne(
        { _id: existing._id },
        { $set: { status, updatedAt: new Date(), updatedBy: ctx.userId } },
      );

      const updated = await db.collection('projects').findOne({ _id: existing._id });
      res.json(updated);
    } catch (e: any) {
      const status = e.status || 500;
      res.status(status).json({ message: e.message, code: e.code });
    }
  });

  // 6. PUT /api/projects/:id/geofences
  router.put('/:id/geofences', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      const { geofences } = req.body;

      const gfErr = validateGeofences(geofences);
      if (gfErr) return res.status(400).json({ message: gfErr });

      const existing = await assertProjectAccess(db, ctx, req.params.id, { requireActive: false });

      const now = new Date();
      const sanitizedGeofences = geofences.map((g: any, idx: number) => ({
        id: g.id || `gf_${Date.now()}_${idx}`,
        name: String(g.name).trim(),
        boundaryType: g.boundaryType,
        center:
          g.boundaryType === 'circle' && g.center
            ? {
                latitude: Number(g.center.latitude),
                longitude: Number(g.center.longitude),
              }
            : undefined,
        radius: g.boundaryType === 'circle' ? Number(g.radius) : undefined,
        coordinates:
          g.boundaryType === 'polygon' && Array.isArray(g.coordinates)
            ? g.coordinates.map((pt: any) => [Number(pt[0]), Number(pt[1])])
            : undefined,
        isActive: g.isActive !== false,
        createdAt: g.createdAt ? new Date(g.createdAt) : now,
        updatedAt: now,
      }));

      await db.collection('projects').updateOne(
        { _id: existing._id },
        { $set: { geofences: sanitizedGeofences, updatedAt: now, updatedBy: ctx.userId } },
      );

      const updated = await db.collection('projects').findOne({ _id: existing._id });

      if (logAudit) {
        await logAudit(db, {
          actorId: ctx.userId,
          actorType: 'user',
          companyId: ctx.companyId,
          action: 'GEOFENCE_UPDATED',
          resource: 'projects',
          resourceId: String(existing._id),
          projectId: String(existing._id),
          newValue: { geofenceCount: sanitizedGeofences.length },
        });
      }

      res.json(updated);
    } catch (e: any) {
      const status = e.status || 500;
      res.status(status).json({ message: e.message, code: e.code });
    }
  });

  // 7. POST /api/projects/:id/assign-partner
  router.post('/:id/assign-partner', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const ctx = await resolveUserAndCompany(req, db);
      if (!ctx.isCompanyAdmin) {
        return res.status(403).json({ message: 'Only Company Admins or Owners can assign Project Partner Admins' });
      }

      const { partnerAdminIds } = req.body;
      if (!Array.isArray(partnerAdminIds)) {
        return res.status(400).json({ message: 'partnerAdminIds must be an array of user IDs' });
      }

      const project = await assertProjectAccess(db, ctx, req.params.id, { requireActive: false });
      const pIdStr = String(project._id || project.id);
      const strIds = partnerAdminIds.map(String);

      await db.collection('projects').updateOne(
        { _id: project._id },
        { $set: { assignedPartnerAdminIds: strIds, updatedAt: new Date(), updatedBy: ctx.userId } },
      );

      // Prune removed partners from this project
      const previous = (project.assignedPartnerAdminIds || []).map(String);
      const removed = previous.filter((id: string) => !strIds.includes(id));
      for (const partnerId of removed) {
        const uQuery =
          ObjectId.isValid(partnerId) && partnerId.length === 24
            ? { $or: [{ _id: new ObjectId(partnerId) }, { _id: partnerId }] }
            : { _id: partnerId };
        await db.collection('users').updateOne(uQuery, { $pull: { assignedProjects: pIdStr } });
      }

      for (const partnerId of strIds) {
        const uQuery =
          ObjectId.isValid(partnerId) && partnerId.length === 24
            ? { $or: [{ _id: new ObjectId(partnerId) }, { _id: partnerId }] }
            : { _id: partnerId };
        await db.collection('users').updateOne(uQuery, {
          $addToSet: { assignedProjects: pIdStr },
        });
      }

      const updated = await db.collection('projects').findOne({ _id: project._id });
      res.json(updated);
    } catch (e: any) {
      const status = e.status || 500;
      res.status(status).json({ message: e.message, code: e.code });
    }
  });

  return router;
}

// Re-export for module adapters
export { projectIdQuery, resolveUserAndCompany, assertProjectAccess };
