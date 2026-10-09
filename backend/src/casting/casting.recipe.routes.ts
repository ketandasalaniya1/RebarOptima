import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  ICastingRecipe,
  ICastingRecipeVersion,
  ConcreteGrade
} from './casting.types';
import { calculateWaterRatios } from './casting.calculation.service';

export function createCastingRecipeRouter(getDb: () => any, authMiddleware: any, logAudit?: any) {
  const router = Router();

  const resolveCompanyId = async (req: any, db: any): Promise<string> => {
    if (req.user?.companyId) return String(req.user.companyId);
    const userId = req.user?.sub;
    if (userId) {
      try {
        const u = await db.collection('users').findOne({
          $or: [{ _id: new ObjectId(userId) }, { _id: userId }]
        });
        if (u && u.companyId) return String(u.companyId);
      } catch {}
    }
    return req.user?.companyId || 'default-company';
  };

  const toObjId = (id: any) => {
    if (!id) return null;
    if (id instanceof ObjectId) return id;
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }
    return null;
  };

  const idQuery = (id: any) => {
    const objId = toObjId(id);
    return objId ? { $or: [{ _id: objId }, { _id: String(id) }] } : { _id: String(id) };
  };

  // 1. GET / — List recipes with optional grade/status filters
  router.get('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const { grade, status, search } = req.query;

      const query: any = { companyId, isArchived: { $ne: true } };
      if (grade) query.grade = String(grade);

      const recipes = await db.collection('casting_recipes').find(query).sort({ createdAt: -1 }).toArray();

      // Format response with active approved version details and calculated ratios
      const result = recipes.map((r: ICastingRecipe) => {
        const activeVer = r.versions?.find(v => v.versionNumber === r.activeApprovedVersion) || r.versions?.[r.versions.length - 1];
        let ratioEval: any = null;
        if (activeVer) {
          ratioEval = calculateWaterRatios(activeVer);
        }

        return {
          ...r,
          activeVersionDetails: activeVer,
          ratioEvaluation: ratioEval
        };
      });

      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. POST / — Create new recipe (Draft v1.0)
  router.post('/', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const userId = req.user?.sub || 'system';
      const userName = req.user?.name || req.user?.email || 'User';

      const {
        recipeCode,
        grade,
        displayName,
        description,
        mixType = 'SITE_BATCHING',
        rmcVendorName,
        rmcPlantLocation,
        rmcMixCode,
        engineeringLimits = {},
        ingredients = []
      } = req.body;

      if (!recipeCode || !grade || !displayName) {
        return res.status(400).json({ success: false, message: 'recipeCode, grade, and displayName are required' });
      }

      // Check unique code per company
      const existing = await db.collection('casting_recipes').findOne({
        companyId,
        recipeCode: String(recipeCode).trim(),
        isArchived: { $ne: true }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `Recipe code '${recipeCode}' already exists for this company` });
      }

      // Initial Draft v1.0
      const initialVersion: ICastingRecipeVersion = {
        versionNumber: '1.0',
        versionNotes: 'Initial mix design draft',
        mixType,
        rmcVendorName,
        rmcPlantLocation,
        rmcMixCode,
        engineeringLimits,
        ingredients,
        approvalStatus: 'DRAFT',
        submittedBy: {
          userId: String(userId),
          name: userName,
          date: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const ratioEval = calculateWaterRatios(initialVersion);
      initialVersion.calculatedWaterCementRatio = ratioEval.waterCementRatio.value;
      initialVersion.calculatedWaterCementitiousRatio = ratioEval.waterCementitiousRatio.value;
      initialVersion.waterRatioNotes = `${ratioEval.waterCementRatio.reason} | ${ratioEval.waterCementitiousRatio.reason}`;

      const recipeDoc: ICastingRecipe = {
        companyId,
        recipeCode: String(recipeCode).trim(),
        grade: grade as ConcreteGrade,
        displayName: String(displayName).trim(),
        description: description ? String(description).trim() : undefined,
        activeApprovedVersion: undefined,
        versions: [initialVersion],
        isArchived: false,
        createdBy: String(userId),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('casting_recipes').insertOne(recipeDoc);
      const created = { ...recipeDoc, _id: result.insertedId };

      if (logAudit) {
        await logAudit(db, {
          actorId: String(userId),
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'CREATE_CASTING_RECIPE',
          resource: 'casting_recipes',
          resourceId: result.insertedId.toString(),
          description: `Created mix recipe ${recipeCode} (${grade})`
        });
      }

      return res.status(201).json({ success: true, data: created, ratioEvaluation: ratioEval });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. GET /:id — Get recipe details with all version history
  router.get('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const recipe = await db.collection('casting_recipes').findOne({
        ...idQuery(req.params.id),
        companyId
      });

      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const versionEvaluations = recipe.versions?.map((v: ICastingRecipeVersion) => ({
        versionNumber: v.versionNumber,
        approvalStatus: v.approvalStatus,
        ratioEvaluation: calculateWaterRatios(v)
      }));

      return res.json({ success: true, data: recipe, versionEvaluations });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. POST /:id/versions — Fork existing recipe into a new draft version
  router.post('/:id/versions', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const userId = req.user?.sub || 'system';
      const userName = req.user?.name || req.user?.email || 'User';

      const recipe = await db.collection('casting_recipes').findOne({
        ...idQuery(req.params.id),
        companyId
      });

      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const existingVersions = recipe.versions || [];
      const latestVerNum = existingVersions.length > 0 ? parseFloat(existingVersions[existingVersions.length - 1].versionNumber) : 1.0;
      const nextVerNum = (Math.floor(latestVerNum) + 1.0).toFixed(1);

      const {
        versionNotes = `Revision ${nextVerNum}`,
        mixType = existingVersions[existingVersions.length - 1]?.mixType || 'SITE_BATCHING',
        rmcVendorName,
        rmcPlantLocation,
        rmcMixCode,
        engineeringLimits = existingVersions[existingVersions.length - 1]?.engineeringLimits || {},
        ingredients = existingVersions[existingVersions.length - 1]?.ingredients || []
      } = req.body;

      const newVersion: ICastingRecipeVersion = {
        versionNumber: nextVerNum,
        versionNotes,
        mixType,
        rmcVendorName,
        rmcPlantLocation,
        rmcMixCode,
        engineeringLimits,
        ingredients,
        approvalStatus: 'DRAFT',
        submittedBy: {
          userId: String(userId),
          name: userName,
          date: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const ratioEval = calculateWaterRatios(newVersion);
      newVersion.calculatedWaterCementRatio = ratioEval.waterCementRatio.value;
      newVersion.calculatedWaterCementitiousRatio = ratioEval.waterCementitiousRatio.value;
      newVersion.waterRatioNotes = `${ratioEval.waterCementRatio.reason} | ${ratioEval.waterCementitiousRatio.reason}`;

      await db.collection('casting_recipes').updateOne(
        { ...idQuery(req.params.id), companyId },
        {
          $push: { versions: newVersion },
          $set: { updatedAt: new Date() }
        }
      );

      return res.status(201).json({ success: true, data: newVersion, ratioEvaluation: ratioEval });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. PUT /:id/versions/:vNum — Update a draft version
  router.put('/:id/versions/:vNum', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const recipe = await db.collection('casting_recipes').findOne({
        ...idQuery(req.params.id),
        companyId
      });

      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const vNum = String(req.params.vNum);
      const targetVerIndex = recipe.versions?.findIndex((v: ICastingRecipeVersion) => v.versionNumber === vNum);
      if (targetVerIndex === -1 || targetVerIndex === undefined) {
        return res.status(404).json({ success: false, message: `Version ${vNum} not found` });
      }

      const targetVer = recipe.versions[targetVerIndex];
      if (targetVer.approvalStatus !== 'DRAFT' && targetVer.approvalStatus !== 'REJECTED') {
        return res.status(403).json({
          success: false,
          message: `Cannot edit version in '${targetVer.approvalStatus}' status. Approved versions are immutable. Create a new version.`
        });
      }

      const {
        versionNotes,
        mixType,
        rmcVendorName,
        rmcPlantLocation,
        rmcMixCode,
        engineeringLimits,
        ingredients
      } = req.body;

      if (versionNotes !== undefined) targetVer.versionNotes = versionNotes;
      if (mixType !== undefined) targetVer.mixType = mixType;
      if (rmcVendorName !== undefined) targetVer.rmcVendorName = rmcVendorName;
      if (rmcPlantLocation !== undefined) targetVer.rmcPlantLocation = rmcPlantLocation;
      if (rmcMixCode !== undefined) targetVer.rmcMixCode = rmcMixCode;
      if (engineeringLimits !== undefined) targetVer.engineeringLimits = engineeringLimits;
      if (ingredients !== undefined) targetVer.ingredients = ingredients;

      const ratioEval = calculateWaterRatios(targetVer);
      targetVer.calculatedWaterCementRatio = ratioEval.waterCementRatio.value;
      targetVer.calculatedWaterCementitiousRatio = ratioEval.waterCementitiousRatio.value;
      targetVer.waterRatioNotes = `${ratioEval.waterCementRatio.reason} | ${ratioEval.waterCementitiousRatio.reason}`;
      targetVer.updatedAt = new Date();

      await db.collection('casting_recipes').updateOne(
        { ...idQuery(req.params.id), companyId },
        {
          $set: {
            [`versions.${targetVerIndex}`]: targetVer,
            updatedAt: new Date()
          }
        }
      );

      return res.json({ success: true, data: targetVer, ratioEvaluation: ratioEval });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. POST /:id/versions/:vNum/submit — Submit draft for technical review
  router.post('/:id/versions/:vNum/submit', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const userId = req.user?.sub || 'system';
      const userName = req.user?.name || req.user?.email || 'User';

      const recipe = await db.collection('casting_recipes').findOne({
        ...idQuery(req.params.id),
        companyId
      });

      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const vNum = String(req.params.vNum);
      const targetVerIndex = recipe.versions?.findIndex((v: ICastingRecipeVersion) => v.versionNumber === vNum);
      if (targetVerIndex === -1 || targetVerIndex === undefined) {
        return res.status(404).json({ success: false, message: `Version ${vNum} not found` });
      }

      const targetVer = recipe.versions[targetVerIndex];
      if (targetVer.approvalStatus !== 'DRAFT' && targetVer.approvalStatus !== 'REJECTED') {
        return res.status(400).json({ success: false, message: `Version is already in ${targetVer.approvalStatus} status` });
      }

      targetVer.approvalStatus = 'SUBMITTED_FOR_REVIEW';
      targetVer.submittedBy = {
        userId: String(userId),
        name: userName,
        date: new Date()
      };
      targetVer.updatedAt = new Date();

      await db.collection('casting_recipes').updateOne(
        { ...idQuery(req.params.id), companyId },
        {
          $set: {
            [`versions.${targetVerIndex}`]: targetVer,
            updatedAt: new Date()
          }
        }
      );

      return res.json({ success: true, message: `Version ${vNum} submitted for review`, data: targetVer });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. POST /:id/versions/:vNum/approve — Approve recipe version (enforces maker-checker)
  router.post('/:id/versions/:vNum/approve', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const userId = req.user?.sub || 'system';
      const userName = req.user?.name || req.user?.email || 'Authorized Approver';
      const { remarks = 'Technically approved for site casting' } = req.body;

      const recipe = await db.collection('casting_recipes').findOne({
        ...idQuery(req.params.id),
        companyId
      });

      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const vNum = String(req.params.vNum);
      const targetVerIndex = recipe.versions?.findIndex((v: ICastingRecipeVersion) => v.versionNumber === vNum);
      if (targetVerIndex === -1 || targetVerIndex === undefined) {
        return res.status(404).json({ success: false, message: `Version ${vNum} not found` });
      }

      const targetVer = recipe.versions[targetVerIndex];

      // Maker-Checker Rule Enforcement
      if (targetVer.submittedBy?.userId && String(targetVer.submittedBy.userId) === String(userId)) {
        // Enforce maker-checker: author cannot approve their own recipe
        return res.status(403).json({
          success: false,
          message: 'Maker-Checker Violation: You cannot approve a recipe version that you created or submitted.'
        });
      }

      // Check engineering verification
      const ratioEval = calculateWaterRatios(targetVer);
      if (ratioEval.engineeringCompliance.status === 'CANNOT_VERIFY_MISSING_INPUTS') {
        return res.status(400).json({
          success: false,
          message: 'Cannot approve recipe: Incomplete ingredients or missing calculation basis.',
          details: ratioEval.engineeringCompliance.details
        });
      }

      // Mark any previously approved version as SUPERSEDED
      const updatedVersions = recipe.versions.map((v: ICastingRecipeVersion) => {
        if (v.versionNumber === vNum) {
          return {
            ...v,
            approvalStatus: 'APPROVED',
            approvedBy: {
              userId: String(userId),
              name: userName,
              date: new Date(),
              remarks: String(remarks)
            },
            effectiveFrom: new Date(),
            updatedAt: new Date()
          };
        } else if (v.approvalStatus === 'APPROVED') {
          return {
            ...v,
            approvalStatus: 'SUPERSEDED',
            effectiveTo: new Date(),
            updatedAt: new Date()
          };
        }
        return v;
      });

      await db.collection('casting_recipes').updateOne(
        { ...idQuery(req.params.id), companyId },
        {
          $set: {
            versions: updatedVersions,
            activeApprovedVersion: vNum,
            updatedAt: new Date()
          }
        }
      );

      if (logAudit) {
        await logAudit(db, {
          actorId: String(userId),
          actorType: req.user?.accountType || 'user',
          companyId,
          module: 'casting',
          action: 'APPROVE_CASTING_RECIPE',
          resource: 'casting_recipes',
          resourceId: recipe._id.toString(),
          description: `Approved mix recipe ${recipe.recipeCode} version ${vNum}`
        });
      }

      return res.json({ success: true, message: `Recipe version ${vNum} approved successfully`, activeApprovedVersion: vNum });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 8. POST /:id/versions/:vNum/reject — Reject version with mandatory remarks
  router.post('/:id/versions/:vNum/reject', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const userId = req.user?.sub || 'system';
      const userName = req.user?.name || req.user?.email || 'Reviewer';
      const { remarks } = req.body;

      if (!remarks || String(remarks).trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Rejection remarks are mandatory' });
      }

      const recipe = await db.collection('casting_recipes').findOne({
        ...idQuery(req.params.id),
        companyId
      });

      if (!recipe) {
        return res.status(404).json({ success: false, message: 'Recipe not found' });
      }

      const vNum = String(req.params.vNum);
      const targetVerIndex = recipe.versions?.findIndex((v: ICastingRecipeVersion) => v.versionNumber === vNum);
      if (targetVerIndex === -1 || targetVerIndex === undefined) {
        return res.status(404).json({ success: false, message: `Version ${vNum} not found` });
      }

      const targetVer = recipe.versions[targetVerIndex];
      targetVer.approvalStatus = 'REJECTED';
      targetVer.approvedBy = {
        userId: String(userId),
        name: userName,
        date: new Date(),
        remarks: String(remarks).trim()
      };
      targetVer.updatedAt = new Date();

      await db.collection('casting_recipes').updateOne(
        { ...idQuery(req.params.id), companyId },
        {
          $set: {
            [`versions.${targetVerIndex}`]: targetVer,
            updatedAt: new Date()
          }
        }
      );

      return res.json({ success: true, message: `Version ${vNum} rejected`, data: targetVer });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 9. DELETE /:id — Soft-archive recipe
  router.delete('/:id', authMiddleware, async (req: any, res: any) => {
    try {
      const db = getDb();
      const companyId = await resolveCompanyId(req, db);
      const userId = req.user?.sub || 'system';

      await db.collection('casting_recipes').updateOne(
        { ...idQuery(req.params.id), companyId },
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            archivedBy: userId,
            updatedAt: new Date()
          }
        }
      );

      return res.json({ success: true, message: 'Recipe archived successfully' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
}
