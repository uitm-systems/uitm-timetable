import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import api from "./api.js";

const server = new Server(
  {
    name: "uitm-timetable-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_campuses",
        description: "List all available UiTM campuses.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_courses",
        description: "List courses for a specific campus.",
        inputSchema: {
          type: "object",
          properties: {
            campusId: { type: "string", description: "Campus ID (e.g., 'A', 'B')" },
          },
          required: ["campusId"],
        },
      },
      {
        name: "get_timetable",
        description: "Get the timetable for a specific course by its path.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "The path returned from list_courses" },
          },
          required: ["path"],
        },
      },
      {
        name: "search_timetable",
        description: "Find the timetable for a specific course code within a campus.",
        inputSchema: {
          type: "object",
          properties: {
            campusId: { type: "string", description: "Campus ID (e.g., 'A', 'B')" },
            courseCode: { type: "string", description: "Course Code (e.g., 'CSC134')" },
          },
          required: ["campusId", "courseCode"],
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_campuses") {
      const campuses = await api.fetchCampuses();
      return {
        content: [{ type: "text", text: JSON.stringify(campuses, null, 2) }],
      };
    }

    if (name === "list_courses") {
      const courses = await api.fetchCourses(args.campusId);
      return {
        content: [{ type: "text", text: JSON.stringify(courses, null, 2) }],
      };
    }

    if (name === "get_timetable") {
      const groups = await api.fetchTimetableGroups(args.path);
      return {
        content: [{ type: "text", text: JSON.stringify(groups, null, 2) }],
      };
    }
    
    if (name === "search_timetable") {
      const courses = await api.fetchCourses(args.campusId);
      const targetCourse = courses.find(c => c.code.toUpperCase() === args.courseCode.toUpperCase());
      if (!targetCourse) {
        return {
          content: [{ type: "text", text: `Course ${args.courseCode} not found in campus ${args.campusId}` }],
          isError: true
        }
      }
      const groups = await api.fetchTimetableGroups(targetCourse.path);
      return {
        content: [{ type: "text", text: JSON.stringify({ course: targetCourse, groups }, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UiTM Timetable MCP server running on stdio");
}

run().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
