
import { searchProducts } from "../src/actions/fiscal_db";

async function test() {
    console.log("Testing searchProducts with 'lamp'...");
    const results = await searchProducts("lamp");
    console.log("Results:", results);
}

test();
