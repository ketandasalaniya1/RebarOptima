import { IAIProvider, IAIProviderParams, IAIProviderResult, IRolePromptSuggestion } from './ai-assistant.types';

export class MockAIProvider implements IAIProvider {
  /**
   * Predefined prompt suggestions for each of the 10 roles
   */
  public static getRolePrompts(roleNormalized: string): IRolePromptSuggestion[] {
    const role = roleNormalized.toUpperCase();

    // 1. Super Admin
    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN' || role === 'DEVELOPER') {
      return [
        {
          id: 'sa-kpi',
          title: 'Organization KPI Overview',
          prompt: 'Provide an executive summary of active projects, total budget variance, and overall construction health across all sites.',
          category: 'Executive Overview',
          icon: 'LayoutDashboard',
          roles: ['SUPER_ADMIN'],
        },
        {
          id: 'sa-steel',
          title: 'Enterprise Steel & Scrap Ratio',
          prompt: 'What is our company-wide scrap percentage and rebar cutting efficiency for the current quarter?',
          category: 'Steel Analytics',
          icon: 'Layers',
          roles: ['SUPER_ADMIN'],
        },
        {
          id: 'sa-activity',
          title: 'Cross-Project User Activity',
          prompt: 'Show high-level user login volume and critical audit log entries across all sites today.',
          category: 'Governance',
          icon: 'Shield',
          roles: ['SUPER_ADMIN'],
        },
        {
          id: 'sa-financial',
          title: 'Enterprise Cashflow & Vendor Aging',
          prompt: 'Summarize total pending vendor disbursements and petty cash approvals across all active projects.',
          category: 'Finance',
          icon: 'Wallet',
          roles: ['SUPER_ADMIN'],
        },
      ];
    }

    // 2. Company Admin
    if (role === 'ADMIN' || role === 'OWNER' || role === 'COMPANY_ADMIN') {
      return [
        {
          id: 'ca-summary',
          title: 'Project Status & Milestones',
          prompt: 'Summarize overall progress, critical path delays, and upcoming slab casting targets for this project.',
          category: 'Executive Summary',
          icon: 'Building2',
          roles: ['COMPANY_ADMIN'],
        },
        {
          id: 'ca-procurement',
          title: 'Steel Procurement & Yard Stock',
          prompt: 'What is our current live yard inventory in MT and pending rebar purchase requisitions?',
          category: 'Procurement',
          icon: 'Package',
          roles: ['COMPANY_ADMIN'],
        },
        {
          id: 'ca-sales-crm',
          title: 'CRM Sales & Booking Progress',
          prompt: 'What is the current unit inventory status (Available vs Booked) and collection performance this month?',
          category: 'Sales',
          icon: 'Home',
          roles: ['COMPANY_ADMIN'],
        },
        {
          id: 'ca-cashflow',
          title: 'Petty Cash & Expense Approval',
          prompt: 'Show petty cash balance, today’s expenses, and pending voucher approvals for this site.',
          category: 'Finance',
          icon: 'Wallet',
          roles: ['COMPANY_ADMIN'],
        },
      ];
    }

    // 3. Project Manager
    if (role === 'PROJECT_MANAGER' || role === 'PM' || role === 'PROJECTPARTNERADMIN' || role === 'PROJECT_PARTNER_ADMIN') {
      return [
        {
          id: 'pm-schedule',
          title: 'Milestone & Casting Schedule',
          prompt: 'What are the upcoming pour milestones for the next 7 days, and are any checklist sign-offs pending?',
          category: 'Project Schedule',
          icon: 'CalendarRange',
          roles: ['PROJECT_MANAGER'],
        },
        {
          id: 'pm-manpower',
          title: 'Daily Labour & Productivity',
          prompt: 'Compare today’s on-site labour headcount against planned muster roll targets across all active contractors.',
          category: 'Manpower',
          icon: 'UsersRound',
          roles: ['PROJECT_MANAGER'],
        },
        {
          id: 'pm-drawings',
          title: 'GFC Drawings & Revisions',
          prompt: 'Are there any recent architectural or structural GFC drawing revisions that require site engineer review?',
          category: 'Drawings',
          icon: 'FileStack',
          roles: ['PROJECT_MANAGER'],
        },
        {
          id: 'pm-material-risk',
          title: 'Material Buffer & Shortage Alert',
          prompt: 'Check stock levels for 16mm/20mm rebar and OPC 53 cement against scheduled casting requirements for this week.',
          category: 'Material Tracking',
          icon: 'Boxes',
          roles: ['PROJECT_MANAGER'],
        },
      ];
    }

    // 4. Senior Site Engineer
    if (role === 'SENIOR_SITE_ENGINEER' || role === 'SR_SITE_ENGINEER') {
      return [
        {
          id: 'sse-bbs',
          title: 'BBS Optimization & Scrap Rate',
          prompt: 'Analyze current 1D cutting stock scrap percentage for the upcoming Tower Floor Beams and Columns.',
          category: 'BBS & Rebar',
          icon: 'Ruler',
          roles: ['SENIOR_SITE_ENGINEER'],
        },
        {
          id: 'sse-pour-qc',
          title: 'Casting Clearances & QC Logs',
          prompt: 'Show all pre-pour inspection checklists and cube compressive strength test results for recent slabs.',
          category: 'Quality & Casting',
          icon: 'Boxes',
          roles: ['SENIOR_SITE_ENGINEER'],
        },
        {
          id: 'sse-dwg-rev',
          title: 'Structural Drawing Discrepancies',
          prompt: 'Review latest structural revision tags and highlight any column schedule changes from Rev 2 to Rev 3.',
          category: 'Technical Drawings',
          icon: 'FileStack',
          roles: ['SENIOR_SITE_ENGINEER'],
        },
        {
          id: 'sse-remnant',
          title: 'Yard Remnant Bar Utilization',
          prompt: 'Which offcut remnants between 2.5m and 5.0m can be matched for retaining wall dowels or stirrups?',
          category: 'Steel Efficiency',
          icon: 'Layers',
          roles: ['SENIOR_SITE_ENGINEER'],
        },
      ];
    }

    // 5. Site Engineer
    if (role === 'SITE_ENGINEER') {
      return [
        {
          id: 'se-cutlist',
          title: 'Daily Bar Cutting Schedule',
          prompt: 'Generate the daily bar bending and cutting schedule for today’s slab reinforcement team.',
          category: 'Site Execution',
          icon: 'Ruler',
          roles: ['SITE_ENGINEER'],
        },
        {
          id: 'se-pour-ready',
          title: 'Pre-Pour Checklist Verification',
          prompt: 'What inspection items are pending verification before starting tomorrow morning’s concrete pour?',
          category: 'Casting Inspection',
          icon: 'CheckSquare',
          roles: ['SITE_ENGINEER'],
        },
        {
          id: 'se-yard-check',
          title: 'Stock Availability by Diameter',
          prompt: 'Do we have sufficient 12mm and 16mm Fe500D rebar in the yard to complete Beam B-12 to B-16?',
          category: 'Yard Stock',
          icon: 'Warehouse',
          roles: ['SITE_ENGINEER'],
        },
        {
          id: 'se-dwg-viewer',
          title: 'Latest Approved GFC Drawing',
          prompt: 'Confirm the latest revision number and release date for the 3rd Floor Typical Structural Layout.',
          category: 'Drawings',
          icon: 'FileStack',
          roles: ['SITE_ENGINEER'],
        },
      ];
    }

    // 6. Supervisor
    if (role === 'SUPERVISOR') {
      return [
        {
          id: 'sup-labour-alloc',
          title: 'Shift Labour Gang Allocation',
          prompt: 'Show today’s gang distribution: number of barbenders, carpenters, and helpers allocated per grid line.',
          category: 'Field Supervision',
          icon: 'HardHat',
          roles: ['SUPERVISOR'],
        },
        {
          id: 'sup-pour-progress',
          title: 'Concrete Pour Log Status',
          prompt: 'Track transit mixer arrivals, slump measurements, and volume poured so far for today’s pour.',
          category: 'Concrete Pour',
          icon: 'Boxes',
          roles: ['SUPERVISOR'],
        },
        {
          id: 'sup-safety',
          title: 'Daily Site Safety Checklist',
          prompt: 'What are the mandatory PPE, edge protection, and scaffolding checklist items for today’s work at height?',
          category: 'Safety & QC',
          icon: 'Shield',
          roles: ['SUPERVISOR'],
        },
        {
          id: 'sup-tools',
          title: 'Equipment & Machinery Availability',
          prompt: 'Check operational status of bar cutting machines, bending rollers, and vibrator needles on site.',
          category: 'Equipment',
          icon: 'Package',
          roles: ['SUPERVISOR'],
        },
      ];
    }

    // 7. Store Keeper
    if (role === 'STORE_KEEPER' || role === 'STOREKEEPER') {
      return [
        {
          id: 'sk-yard-balance',
          title: 'Live Steel Yard Inventory',
          prompt: 'Provide a breakdown of current rebar tonnage in the yard grouped by diameter (8mm to 32mm).',
          category: 'Inventory Balance',
          icon: 'Warehouse',
          roles: ['STORE_KEEPER'],
        },
        {
          id: 'sk-inwards',
          title: 'Recent Inward Steel Deliveries',
          prompt: 'List rebar consignments received this week with weighbridge slip numbers, vendor name, and heat numbers.',
          category: 'Inward Consignments',
          icon: 'PackagePlus',
          roles: ['STORE_KEEPER'],
        },
        {
          id: 'sk-scrap-balance',
          title: 'Scrap & Unusable Offcuts Weight',
          prompt: 'What is the current accumulated scrap steel weight ready for commercial disposal in the yard?',
          category: 'Scrap Management',
          icon: 'Scale',
          roles: ['STORE_KEEPER'],
        },
        {
          id: 'sk-cement-sand',
          title: 'Cement & Aggregate Stock Level',
          prompt: 'What are our current stock levels of OPC 53 cement bags, sand (river/m-sand), and 20mm aggregate?',
          category: 'General Materials',
          icon: 'Boxes',
          roles: ['STORE_KEEPER'],
        },
      ];
    }

    // 8. HR
    if (role === 'HR' || role === 'HUMAN_RESOURCES') {
      return [
        {
          id: 'hr-attendance',
          title: 'Today’s Labour Attendance',
          prompt: 'What is total worker attendance count across direct company labour and contractor muster rolls today?',
          category: 'Attendance',
          icon: 'CalendarCheck2',
          roles: ['HR'],
        },
        {
          id: 'hr-muster-roll',
          title: 'Contractor Muster Roll Breakdown',
          prompt: 'Show attendance breakdown by contractor (skilled vs unskilled) and identify any absenteeism spikes.',
          category: 'Contractor Workforce',
          icon: 'Users',
          roles: ['HR'],
        },
        {
          id: 'hr-overtime',
          title: 'Overtime & Extended Hours Summary',
          prompt: 'Summarize overtime hours logged for night pour operations during the past 7 days.',
          category: 'Overtime',
          icon: 'Clock',
          roles: ['HR'],
        },
        {
          id: 'hr-compliance',
          title: 'Worker KYC & Safety Inductions',
          prompt: 'Are there any new workers on site pending KYC verification, insurance documentation, or safety induction?',
          category: 'Labour Compliance',
          icon: 'Shield',
          roles: ['HR'],
        },
      ];
    }

    // 9. Accountant
    if (role === 'ACCOUNTANT' || role === 'ACCOUNTS') {
      return [
        {
          id: 'acc-petty-cash',
          title: 'Petty Cash Balance & Vouchers',
          prompt: 'What is the active petty cash closing balance, and what vouchers are awaiting account manager approval?',
          category: 'Petty Cash',
          icon: 'Wallet',
          roles: ['ACCOUNTANT'],
        },
        {
          id: 'acc-vendor-invoices',
          title: 'Vendor Invoices & Aging',
          prompt: 'Show unpaid material vendor bills due this week along with GST input credit eligibility.',
          category: 'Payables',
          icon: 'FileText',
          roles: ['ACCOUNTANT'],
        },
        {
          id: 'acc-site-spend',
          title: 'Site Material Expenditure',
          prompt: 'Summarize total verified expenditure for Steel, Ready-Mix Concrete, and Hire Charges this month.',
          category: 'Cost Accounting',
          icon: 'TrendingDown',
          roles: ['ACCOUNTANT'],
        },
        {
          id: 'acc-disbursements',
          title: 'Recent Cash Disbursements',
          prompt: 'List recent petty cash disbursements for local hardware, fuel, and municipal water tankers.',
          category: 'Disbursements',
          icon: 'DollarSign',
          roles: ['ACCOUNTANT'],
        },
      ];
    }

    // 10. Sales Person
    if (role === 'SALES_PERSON' || role === 'SALES' || role === 'SALES_EXECUTIVE') {
      return [
        {
          id: 'sp-today-followups',
          title: 'Today’s Scheduled Follow-ups',
          prompt: 'List all customer visits, phone calls, and negotiation meetings scheduled for today.',
          category: 'Daily Tasks',
          icon: 'Calendar',
          roles: ['SALES_PERSON'],
        },
        {
          id: 'sp-inventory-status',
          title: 'Unit Availability & Pricing Matrix',
          prompt: 'Which 2BHK and 3BHK units are currently available for booking in Tower A and Tower B with floor rise?',
          category: 'Inventory',
          icon: 'Building',
          roles: ['SALES_PERSON'],
        },
        {
          id: 'sp-pipeline-stages',
          title: 'Leads Pipeline by Stage',
          prompt: 'How many active leads are currently in "Site Visit Done", "Negotiation", and "Token Expected" stages?',
          category: 'Sales Pipeline',
          icon: 'Kanban',
          roles: ['SALES_PERSON'],
        },
        {
          id: 'sp-booking-advances',
          title: 'Recent Bookings & Token Advances',
          prompt: 'Show all unit bookings logged in the past 14 days and token advance receipts recorded.',
          category: 'Bookings',
          icon: 'CheckSquare',
          roles: ['SALES_PERSON'],
        },
      ];
    }

    return [
      {
        id: 'gen-summary',
        title: 'Project Overview & Status',
        prompt: 'Give me an overview of current activities and milestones for this project.',
        category: 'Overview',
        icon: 'LayoutDashboard',
        roles: ['ALL'],
      },
    ];
  }

  /**
   * Generates grounded responses based on actual database facts
   */
  public async generateResponse(params: IAIProviderParams): Promise<IAIProviderResult> {
    const { prompt, role, roleNormalized, projectName, projectId, userName, groundedContext } = params;
    const lowerPrompt = prompt.toLowerCase();
    const cleanRole = (roleNormalized || role || 'USER').toUpperCase();

    // 1. PERMISSION ACCESS-DENIED GUARDRAILS
    if (['SALES_PERSON', 'SALES', 'SALES_EXECUTIVE'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('petty cash') ||
        lowerPrompt.includes('salary') ||
        lowerPrompt.includes('payroll') ||
        lowerPrompt.includes('disbursement') ||
        lowerPrompt.includes('vendor invoice') ||
        lowerPrompt.includes('bar bending') ||
        lowerPrompt.includes('bbs') ||
        lowerPrompt.includes('offcut') ||
        lowerPrompt.includes('cutting stock')
      ) {
        return {
          category: 'Access Denied',
          content: `⛔ **Access Denied: Permission Boundary Restriction**

You do not have permission to access **Financial Ledger, HR Payroll, or Engineering BBS** modules.

- **Your Current Role**: \`Sales Person\`
- **Authorized Modules**: \`Real Estate CRM\`, \`Unit Inventory Matrix\`, \`Customer Lead Pipeline\`, \`Booking Wizards\`
- **Project Context**: *${projectName}*

Please contact your Project Manager or Company Admin if you require cross-functional access.`,
        };
      }
    }

    if (['STORE_KEEPER', 'STOREKEEPER'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('lead') ||
        lowerPrompt.includes('customer') ||
        lowerPrompt.includes('booking') ||
        lowerPrompt.includes('token') ||
        lowerPrompt.includes('crm') ||
        lowerPrompt.includes('profit margin') ||
        lowerPrompt.includes('salary')
      ) {
        return {
          category: 'Access Denied',
          content: `⛔ **Access Denied: Permission Boundary Restriction**

You do not have permission to access **Customer CRM or Financial Margins**.

- **Your Current Role**: \`Store Keeper\`
- **Authorized Modules**: \`Steel Rebar Yard Stock\`, \`Site Material Inventory\`, \`Inward Vouchers\`, \`Scrap Tonnage\`
- **Project Context**: *${projectName}*

Your role is restricted to physical material inward, stock balances, and scrap dispatch operations.`,
        };
      }
    }

    if (['HR', 'HUMAN_RESOURCES'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('rebar cutting') ||
        lowerPrompt.includes('structural drawing') ||
        lowerPrompt.includes('1d cutting') ||
        lowerPrompt.includes('bar bending schedule') ||
        lowerPrompt.includes('slump test')
      ) {
        return {
          category: 'Access Denied',
          content: `⛔ **Access Denied: Permission Boundary Restriction**

You do not have permission to access **Engineering Technical Drawings or Rebar Optimization**.

- **Your Current Role**: \`HR / Human Resources\`
- **Authorized Modules**: \`Daily Labour Attendance\`, \`Contractor Muster Rolls\`, \`Worker KYC\`, \`Overtime Tracking\`
- **Project Context**: *${projectName}*

Please consult the Site Engineering team for technical construction details.`,
        };
      }
    }

    if (['SITE_ENGINEER', 'SUPERVISOR'].includes(cleanRole)) {
      if (
        lowerPrompt.includes('profit margin') ||
        lowerPrompt.includes('bank account') ||
        lowerPrompt.includes('company ledger') ||
        lowerPrompt.includes('user permissions') ||
        lowerPrompt.includes('delete project')
      ) {
        return {
          category: 'Access Denied',
          content: `⛔ **Access Denied: Permission Boundary Restriction**

You do not have administrative authorization to access **Company Ledger Financials or Security Governance**.

- **Your Current Role**: \`${role}\`
- **Authorized Modules**: \`BBS Schedules\`, \`Casting QC\`, \`Site Execution\`, \`Field Checklists\`
- **Project Context**: *${projectName}*

Financial governance and company settings require \`Company Admin\` or \`Super Admin\` credentials.`,
        };
      }
    }

    const metadata = {
      provider: 'CraveToBuild Grounded Engine',
      asOf: groundedContext?.asOf || new Date().toISOString(),
      projectId: groundedContext?.projectId || projectId,
      projectName: groundedContext?.projectName || projectName,
      sources: groundedContext?.sources || [],
      warnings: groundedContext?.warnings || [],
      groundingStatus: 'verified_database',
    };

    const metrics = groundedContext?.metrics || {};

    // 2. PROJECT OVERVIEW / SUMMARY INTENT
    if (
      lowerPrompt.includes('summarize') ||
      lowerPrompt.includes('summary') ||
      lowerPrompt.includes('overview') ||
      lowerPrompt.includes('progress') ||
      lowerPrompt.includes('status')
    ) {
      const pm = metrics.pm || {};
      const steel = metrics.steel || {};
      const casting = metrics.casting || {};
      const workforce = metrics.workforce || {};
      const proj = metrics.project || {};

      let responseText = `### 📋 Project Summary: **${proj.name || projectName}** [Source: projects DB]

- **Project Status**: **${proj.status || 'Active'}**
- **Type**: **${proj.projectType || 'Standard'}**
- **Tower / Blocks**: ${proj.blocksCount > 0 ? `**${proj.blocksCount} Blocks** (${proj.blockNames?.join(', ')}) [Source: project_blocks]` : '_Information is not available in the connected project records (0 blocks cataloged)._'}

---

#### 📈 Project Completion & Tasks:
${pm.totalTasks > 0
  ? `- **Verified Overall Progress**: **${pm.calculatedOverallProgress}%** [Source: pm_tasks]
- **Tasks Breakdown**: ${pm.completedTasksCount} completed, ${pm.inProgressTasksCount} in-progress, ${pm.overdueTasksCount} overdue out of ${pm.totalTasks} total WBS tasks.`
  : `- **Project Completion**: **Information is not available in the connected project records.** *(0 task or schedule entries exist in \`pm_tasks\`)*`
}

#### 🏗️ Steel & Rebar Consumption:
${steel.totalStockKg > 0
  ? `- **Live Yard Stock**: **${steel.totalStockMT} MT** (${steel.totalStockKg.toLocaleString()} kg) across ${steel.totalItemsCount} cataloged items [Source: stockitems]`
  : `- **Rebar Consumption / Stock**: **Information is not available in the connected project records.** *(0 stock records exist in \`stockitems\`)*`
}

#### 🧪 Concrete Poured:
${casting.totalPours > 0
  ? `- **Total Poured Volume**: **${casting.totalPouredVolumeM3} m³** across ${casting.completedPoursCount} completed pour events [Source: casting_events]`
  : `- **Concrete Poured**: **Information is not available in the connected project records.** *(0 casting events logged in \`casting_events\`)*`
}

#### 👷 Active Workforce:
${workforce.totalHeadcount > 0
  ? `- **Latest Headcount (${workforce.sessionDate})**: **${workforce.totalHeadcount} workers** on site (${workforce.contractorLabourCount} contractor, ${workforce.directLabourPresent} direct) [Source: attendance_sessions]`
  : `- **Workforce Headcount**: **Information is not available in the connected project records.** *(0 attendance sessions logged in \`attendance_sessions\`)*`
}

#### 💰 Budget Utilization:
- **Budget Utilization**: **Information is not available in the connected project records.** *(No project budget or cost records configured in \`pm_costs\`)*`;

      return {
        category: 'Grounded Project Summary',
        content: responseText,
        metadata,
      };
    }

    // 3. STEEL & REBAR INVENTORY INTENT
    if (
      lowerPrompt.includes('steel') ||
      lowerPrompt.includes('rebar') ||
      lowerPrompt.includes('yard') ||
      lowerPrompt.includes('diameter') ||
      lowerPrompt.includes('stock')
    ) {
      const steel = metrics.steel || {};
      if (steel.totalStockKg > 0) {
        const rows = Object.entries(steel.diameterBreakdown || {}).map(([dia, d]: [string, any]) =>
          `| **${dia} mm** | ${d.pieces} | **${(d.weightKg / 1000).toFixed(2)} MT** | ${d.standardTons.toFixed(2)} MT | ${d.remnantTons.toFixed(2)} MT |`
        ).join('\n');

        return {
          category: 'Steel Yard Stock',
          content: `### 🏗️ Live Steel Stock — **${projectName}** [Source: stockitems]

- **Total Yard Inventory**: **${steel.totalStockMT} MT** (${steel.totalStockKg.toLocaleString()} kg)
- **Line Items Count**: **${steel.totalItemsCount}**

| Diameter | Pieces | Total Weight | Standard Stock | Remnants |
| :--- | :--- | :--- | :--- | :--- |
${rows}`,
          metadata,
        };
      } else {
        return {
          category: 'Steel Yard Stock',
          content: `### 🏗️ Live Steel Stock — **${projectName}** [Source: stockitems]

**Information is not available in the connected project records.**

There are currently **0 live rebar stock items** cataloged for **${projectName}** in the \`stockitems\` collection. To track live tonnage, please record inward consignments in the Steel Inventory module.`,
          metadata,
        };
      }
    }

    // 4. CONCRETE / CASTING INTENT
    if (
      lowerPrompt.includes('pour') ||
      lowerPrompt.includes('casting') ||
      lowerPrompt.includes('concrete') ||
      lowerPrompt.includes('slab')
    ) {
      const casting = metrics.casting || {};
      if (casting.totalPours > 0) {
        const upcoming = casting.upcomingPours || [];
        return {
          category: 'Casting & Pours',
          content: `### 🧪 Concrete Pour Status — **${projectName}** [Source: casting_events]

- **Total Pours Recorded**: **${casting.totalPours}**
- **Total Poured Volume**: **${casting.totalPouredVolumeM3} m³**

#### 📅 Upcoming Scheduled Pours:
${upcoming.length > 0
  ? upcoming.map((p: any) => `- **${p.castingCode}** on **${p.eventDate}**: ${p.concreteGrade}, ${p.plannedQuantityM3 || '?'} m³ at ${p.pourLocation} (Status: ${p.status})`).join('\n')
  : 'None currently scheduled after today.'
}`,
          metadata,
        };
      } else {
        return {
          category: 'Casting & Pours',
          content: `### 🧪 Concrete Pour Status — **${projectName}** [Source: casting_events]

**Information is not available in the connected project records.**

There are **0 concrete pour records** logged for **${projectName}** in \`casting_events\`. No historical or upcoming slab castings have been scheduled in the Casting Management module.`,
          metadata,
        };
      }
    }

    // 5. WORKFORCE / LABOUR INTENT
    if (
      lowerPrompt.includes('labour') ||
      lowerPrompt.includes('labor') ||
      lowerPrompt.includes('worker') ||
      lowerPrompt.includes('manpower') ||
      lowerPrompt.includes('attendance')
    ) {
      const wf = metrics.workforce || {};
      if (wf.totalHeadcount > 0) {
        return {
          category: 'Workforce & Attendance',
          content: `### 👷 Workforce Headcount — **${projectName}** [Source: attendance_sessions]

- **Session Date**: **${wf.sessionDate}**
- **Total Workers On Site**: **${wf.totalHeadcount}**
- **Direct Company Labour**: ${wf.directLabourPresent}
- **Contractor Workforce**: ${wf.contractorLabourCount} across ${wf.contractors?.length || 0} active contractors

#### 👥 Contractor Breakdown:
${(wf.contractors || []).map((c: any) => `- **${c.name}**: ${c.count} workers (${c.skilled} skilled, ${c.unskilled} unskilled)`).join('\n')}`,
          metadata,
        };
      } else {
        return {
          category: 'Workforce & Attendance',
          content: `### 👷 Workforce Headcount — **${projectName}** [Source: attendance_sessions]

**Information is not available in the connected project records.**

No attendance sessions or contractor muster roll entries have been recorded for **${projectName}** in the \`attendance_sessions\` collection.`,
          metadata,
        };
      }
    }

    // 6. DELAYS & OVERDUE ACTIVITIES
    if (
      lowerPrompt.includes('delay') ||
      lowerPrompt.includes('overdue')
    ) {
      const pm = metrics.pm || {};
      const overdueList = pm.overdueList || [];

      if (overdueList.length > 0) {
        return {
          category: 'Project Delays',
          content: `### ⚠️ Overdue Activities — **${projectName}** [Source: pm_tasks]

Found **${overdueList.length} overdue activities** whose planned finish date is in the past:

| Task Name | Planned Finish | Current Progress | Status |
| :--- | :--- | :--- | :--- |
${overdueList.map((t: any) => `| **${t.name}** | ${t.plannedFinish} | ${t.progress}% | ${t.status} |`).join('\n')}`,
          metadata,
        };
      } else if (pm.totalTasks > 0) {
        return {
          category: 'Project Delays',
          content: `### 🟢 Project Delays — **${projectName}** [Source: pm_tasks]

There are currently **0 overdue tasks** out of ${pm.totalTasks} total activities in the project schedule.`,
          metadata,
        };
      } else {
        return {
          category: 'Project Delays',
          content: `### ⚠️ Project Delays — **${projectName}** [Source: pm_tasks]

**Information is not available in the connected project records.**

There are no task or WBS schedule records cataloged for **${projectName}** in \`pm_tasks\`.`,
          metadata,
        };
      }
    }

    // 7. CEMENT & MATERIALS INTENT
    if (
      lowerPrompt.includes('cement') ||
      lowerPrompt.includes('sand') ||
      lowerPrompt.includes('material')
    ) {
      const materials = metrics.materials || [];
      if (materials.length > 0) {
        return {
          category: 'Site Materials',
          content: `### 📦 Material Balances — **${projectName}** [Source: gi_materials]

| Material Name | Category | Current Stock | Unit |
| :--- | :--- | :--- | :--- |
${materials.map((m: any) => `| **${m.name}** | ${m.category} | **${m.currentBalance}** | ${m.unit} |`).join('\n')}`,
          metadata,
        };
      } else {
        return {
          category: 'Site Materials',
          content: `### 📦 Material Balances — **${projectName}** [Source: gi_materials]

**Information is not available in the connected project records.**

No material inventory balances have been configured for **${projectName}** in the Site Inventory module (\`gi_materials\`).`,
          metadata,
        };
      }
    }

    // Default Fallback with grounded brief
    return {
      category: 'Project Inquiry',
      content: `### 📋 Project Data — **${projectName}**

Regarding your query: *"**${prompt}**"*

Here is the verified status from connected database records:
- **Project**: ${metrics.project?.name || projectName} (${metrics.project?.status || 'Active'})
- **Blocks**: ${metrics.project?.blocksCount > 0 ? `${metrics.project?.blocksCount} Blocks` : '0 cataloged'}
- **Tasks**: ${metrics.pm?.totalTasks > 0 ? `${metrics.pm?.totalTasks} tasks (${metrics.pm?.calculatedOverallProgress}% progress)` : '0 records in pm_tasks'}
- **Steel**: ${metrics.steel?.totalStockKg > 0 ? `${metrics.steel?.totalStockMT} MT` : '0 records in stockitems'}
- **Concrete**: ${metrics.casting?.totalPours > 0 ? `${metrics.casting?.totalPouredVolumeM3} m³` : '0 records in casting_events'}
- **Workforce**: ${metrics.workforce?.totalHeadcount > 0 ? `${metrics.workforce?.totalHeadcount} workers` : '0 records in attendance_sessions'}

*For metrics with 0 records, information is not available in the connected database.*`,
      metadata,
    };
  }
}
