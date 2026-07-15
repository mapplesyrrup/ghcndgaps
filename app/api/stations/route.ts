import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runMissingAnalysis, TooManyStationsError } from "@/lib/missingAnalysis";
import { VARIABLES } from "@/lib/types";

const querySchema = z
  .object({
    variable: z.enum(VARIABLES),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    latMin: z.coerce.number().min(-90).max(90),
    latMax: z.coerce.number().min(-90).max(90),
    lonMin: z.coerce.number().min(-180).max(180),
    lonMax: z.coerce.number().min(-180).max(180),
  })
  .refine((v) => v.latMin <= v.latMax, {
    message: "latMin must be <= latMax",
    path: ["latMin"],
  })
  .refine((v) => v.lonMin <= v.lonMax, {
    message: "lonMin must be <= lonMax",
    path: ["lonMin"],
  })
  .refine((v) => new Date(`${v.start}T00:00:00Z`) <= new Date(`${v.end}T00:00:00Z`), {
    message: "start must be on or before end",
    path: ["start"],
  });

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { variable, start, end, latMin, latMax, lonMin, lonMax } = parsed.data;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  try {
    const result = await runMissingAnalysis(variable, startDate, endDate, {
      latMin,
      latMax,
      lonMin,
      lonMax,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TooManyStationsError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Failed to compute station data" },
      { status: 500 },
    );
  }
}
