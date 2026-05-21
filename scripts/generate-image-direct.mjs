/**
 * 独立图片生成脚本 - 直接调用 API 生成图片并保存到 material/
 */
async function main() {
  const prompt = process.argv[2] || "温馨的中国家庭聚餐场景，全家人围坐餐桌举杯庆祝，老少同堂，桌上摆满丰盛菜肴，暖色灯光，笑容满面，喜庆团圆的氛围";

  console.log(`提示词: ${prompt}`);
  console.log("正在生成图片...");

  const response = await fetch(`${process.env.BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen-image-max",
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log("API 响应状态: 成功");

  if (result.data?.[0]?.url) {
    console.log(`下载图片...`);
    const imgResponse = await fetch(result.data[0].url);
    if (!imgResponse.ok) {
      throw new Error(`图片下载失败: ${imgResponse.status}`);
    }
    const arrayBuffer = await imgResponse.arrayBuffer();
    const fs = await import("fs");
    const outputPath = "material/family-toast-celebration-2.png";
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    console.log(`✅ 图片已保存到 ${outputPath} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);
  } else if (result.data?.[0]?.b64_json) {
    const fs = await import("fs");
    const outputPath = "material/family-toast-celebration-2.png";
    fs.writeFileSync(outputPath, Buffer.from(result.data[0].b64_json, "base64"));
    console.log(`✅ 图片已保存到 ${outputPath}`);
  } else {
    console.error("❌ 无法从响应中提取图片数据");
  }
}

main().catch(console.error);
