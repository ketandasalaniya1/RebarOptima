import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const drawingsApiSlice = createApi({
  reducerPath: 'drawingsApiSlice',
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/drawings`,
    prepareHeaders: (headers, { getState }) => {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const activeProject = getState()?.project?.selectedProject;
      const projectId = activeProject?._id || activeProject?.id || localStorage.getItem('rebar_active_project_id');
      if (projectId) {
        headers.set('X-Project-Id', String(projectId));
      }
      return headers;
    },
  }),
  tagTypes: ['Drawing', 'DrawingVersion', 'DrawingMatrix', 'DrawingActivity', 'Approval', 'Transmittal'],
  endpoints: (builder) => ({
    getDrawings: builder.query({
      query: (params = {}) => {
        const sp = new URLSearchParams();
        if (params.projectId && params.projectId !== 'all') sp.append('projectId', params.projectId);
        if (params.blockId && params.blockId !== 'all') sp.append('blockId', params.blockId);
        if (params.disciplineId && params.disciplineId !== 'all') sp.append('disciplineId', params.disciplineId);
        if (params.level && params.level !== 'all') sp.append('level', params.level);
        if (params.status && params.status !== 'all') sp.append('status', params.status);
        if (params.search) sp.append('search', params.search);
        if (params.page) sp.append('page', params.page);
        if (params.limit) sp.append('limit', params.limit);
        const qs = sp.toString();
        return `/drawings${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result?.drawings
          ? [
              ...result.drawings.map(({ _id }) => ({ type: 'Drawing', id: _id })),
              { type: 'Drawing', id: 'LIST' },
            ]
          : [{ type: 'Drawing', id: 'LIST' }],
    }),

    getDrawingById: builder.query({
      query: (id) => `/drawings/${id}`,
      providesTags: (result, error, id) => [{ type: 'Drawing', id }],
    }),

    getDrawingMatrix: builder.query({
      query: ({ projectId, blockId, disciplineId } = {}) => {
        const sp = new URLSearchParams();
        if (projectId && projectId !== 'all') sp.append('projectId', projectId);
        if (blockId && blockId !== 'all') sp.append('blockId', blockId);
        if (disciplineId && disciplineId !== 'all') sp.append('disciplineId', disciplineId);
        const qs = sp.toString();
        return `/matrix${qs ? `?${qs}` : ''}`;
      },
      providesTags: [{ type: 'DrawingMatrix', id: 'GRID' }],
    }),

    createDrawing: builder.mutation({
      query: (body) => ({
        url: '/drawings',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Drawing', id: 'LIST' },
        { type: 'DrawingMatrix', id: 'GRID' },
      ],
    }),

    getDisciplines: builder.query({
      query: () => '/disciplines',
    }),

    getProjects: builder.query({
      query: () => '/projects',
    }),

    getBlocks: builder.query({
      query: (projectId) => {
        const qs = projectId && projectId !== 'all' ? `?projectId=${projectId}` : '';
        return `/blocks${qs}`;
      },
    }),
  }),
});

export const {
  useGetDrawingsQuery,
  useGetDrawingByIdQuery,
  useGetDrawingMatrixQuery,
  useCreateDrawingMutation,
  useGetDisciplinesQuery,
  useGetProjectsQuery,
  useGetBlocksQuery,
} = drawingsApiSlice;
