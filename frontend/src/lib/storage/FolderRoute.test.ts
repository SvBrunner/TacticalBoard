import { describe, it, expect } from "vitest";
import { FolderRoute } from "./FolderRoute";

describe("FolderRoute", () => {
	it("is /folders/<id>, with the id encoded", () => {
		expect(FolderRoute.forFolder("0199a6d0-0000-7000-8000-0000000000f1")).toBe("/folders/0199a6d0-0000-7000-8000-0000000000f1");
		expect(FolderRoute.forFolder("a/b?c")).toBe("/folders/a%2Fb%3Fc");
	});
});
